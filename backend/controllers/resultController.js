const { get, query } = require('../database/db');

/**
 * Helper to safely parse SQLite timestamps as UTC
 */
function parseDbDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
  }
  return new Date(dateStr).getTime();
}

/**
 * Get all historical results for the logged-in student
 * GET /api/results/my-results
 */
async function getMyResults(req, res) {
  try {
    const studentId = req.session.user.id;

    const sql = `
      SELECT
        r.id,
        r.attempt_id,
        r.exam_id,
        e.title AS exam_title,
        e.subject AS exam_subject,
        e.duration_minutes,
        r.total_questions,
        r.attempted_questions,
        r.correct_answers,
        r.incorrect_answers,
        r.unanswered_questions,
        r.total_marks_obtained,
        r.max_marks,
        r.percentage,
        r.accuracy,
        r.completed_at
      FROM Results r
      JOIN Exams e ON r.exam_id = e.id
      WHERE r.student_id = ?
      ORDER BY r.completed_at DESC
    `;

    const results = await query(sql, [studentId]);

    return res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error in getMyResults:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve exam results history'
    });
  }
}

/**
 * Get comprehensive result details by attemptId
 * GET /api/results/:attemptId
 * Accessible by: the student who took the exam, or an admin
 */
async function getResultByAttemptId(req, res) {
  try {
    const { attemptId } = req.params;
    const sessionUser = req.session.user;

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    // 1. Fetch Attempt
    const attempt = await get(
      `SELECT * FROM Exam_Attempts WHERE id = ?`,
      [attemptId]
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Examination attempt not found'
      });
    }

    // Authorization: Must be the student who took it, or an admin
    if (sessionUser.role !== 'admin' && sessionUser.id !== attempt.student_id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view this examination result'
      });
    }

    // 2. Fetch Result record
    const result = await get(
      `SELECT * FROM Results WHERE attempt_id = ?`,
      [attemptId]
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Result has not been generated for this attempt'
      });
    }

    // 3. Fetch Student details
    const student = await get(
      `SELECT id, enrollment_no, name, email, department, course, semester FROM Students WHERE id = ?`,
      [attempt.student_id]
    );

    // 4. Fetch Exam details
    const exam = await get(
      `SELECT id, title, subject, exam_code, duration_minutes, total_questions, max_marks FROM Exams WHERE id = ?`,
      [attempt.exam_id]
    );

    // 5. Fetch Questions & Student Answers for review and topic calculation
    const questionsAndAnswers = await query(
      `SELECT
        q.id,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        q.marks,
        q.topic,
        sa.selected_option,
        sa.is_correct,
        sa.marks_awarded,
        sa.is_marked_for_review
       FROM Questions q
       LEFT JOIN Student_Answers sa ON q.id = sa.question_id AND sa.attempt_id = ?
       WHERE q.exam_id = ?
       ORDER BY q.id ASC`,
      [attemptId, attempt.exam_id]
    );

    // 6. Compute Topic Breakdown
    const topicMap = {};
    for (const item of questionsAndAnswers) {
      const topicName = item.topic || 'General';
      if (!topicMap[topicName]) {
        topicMap[topicName] = {
          topic: topicName,
          total_questions: 0,
          attempted: 0,
          correct: 0,
          incorrect: 0,
          unanswered: 0,
          total_marks: 0,
          marks_obtained: 0
        };
      }

      const t = topicMap[topicName];
      t.total_questions += 1;
      const qMarks = item.marks != null ? Number(item.marks) : 1.0;
      t.total_marks += qMarks;

      if (item.selected_option) {
        t.attempted += 1;
        if (item.is_correct === 1) {
          t.correct += 1;
          t.marks_obtained += item.marks_awarded != null ? Number(item.marks_awarded) : qMarks;
        } else {
          t.incorrect += 1;
        }
      } else {
        t.unanswered += 1;
      }
    }

    const topicBreakdown = Object.values(topicMap).map((t) => {
      const scorePercentage = t.total_marks > 0
        ? Math.round((t.marks_obtained / t.total_marks) * 1000) / 10
        : 0;
      const accuracy = t.attempted > 0
        ? Math.round((t.correct / t.attempted) * 1000) / 10
        : 0;

      return {
        ...t,
        marks_obtained: Math.round(t.marks_obtained * 100) / 100,
        total_marks: Math.round(t.total_marks * 100) / 100,
        score_percentage: scorePercentage,
        accuracy: accuracy
      };
    });

    // 7. Calculate Strengths, Weaknesses, and Recommendations
    let strongestTopic = 'N/A';
    let weakestTopic = 'N/A';
    const improvementTopics = [];
    const recommendations = [];

    if (topicBreakdown.length > 0) {
      const sortedByScore = [...topicBreakdown].sort((a, b) => b.score_percentage - a.score_percentage);
      strongestTopic = sortedByScore[0].topic;
      weakestTopic = sortedByScore[sortedByScore.length - 1].topic;

      topicBreakdown.forEach((tb) => {
        if (tb.score_percentage < 65 || tb.accuracy < 65) {
          improvementTopics.push(tb.topic);
          recommendations.push(
            `In '${tb.topic}', your score was ${tb.score_percentage}%. Review foundational concepts and practice specialized problem sets to boost proficiency.`
          );
        }
      });

      if (recommendations.length === 0) {
        recommendations.push(
          `Excellent consistency across all evaluated domains. Maintain active recall and test challenging variations to preserve mastery.`
        );
      }
    }

    let overallAssessment = 'Satisfactory';
    if (result.percentage >= 85) {
      overallAssessment = 'Outstanding Performance: Demonstrates comprehensive mastery of technical topics and exceptional accuracy under timed conditions.';
    } else if (result.percentage >= 70) {
      overallAssessment = 'Proficient Performance: Solid conceptual clarity with minor gaps in specific sub-domains. Focused revision will elevate scores further.';
    } else if (result.percentage >= 50) {
      overallAssessment = 'Average Competency: Adequate baseline understanding, but several questions suffered from hesitation or conceptual ambiguity.';
    } else {
      overallAssessment = 'Needs Substantial Reinforcement: Foundational syllabus concepts require dedicated review, structured exercises, and re-evaluation.';
    }

    // 8. Historical Exam Performance for Student (for Line Chart)
    const historicalAttempts = await query(
      `SELECT
        r.id,
        r.attempt_id,
        e.title AS exam_title,
        r.percentage,
        r.accuracy,
        r.total_marks_obtained,
        r.max_marks,
        r.completed_at
       FROM Results r
       JOIN Exams e ON r.exam_id = e.id
       WHERE r.student_id = ?
       ORDER BY r.completed_at ASC`,
      [attempt.student_id]
    );

    // Calculate time taken in minutes & seconds
    let timeTakenFormatted = 'N/A';
    if (attempt.start_time && attempt.end_time) {
      const startMs = parseDbDate(attempt.start_time);
      const endMs = parseDbDate(attempt.end_time);
      const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      timeTakenFormatted = `${mins}m ${secs}s`;
    }

    // 9. Fetch all completed attempts for this exam and student (to enable Old vs. New Exam Comparison)
    const examAttempts = await query(
      `SELECT a.id, a.start_time, a.end_time, a.total_score, r.percentage, r.accuracy, r.completed_at
       FROM Exam_Attempts a
       JOIN Results r ON r.attempt_id = a.id
       WHERE a.exam_id = ? AND a.student_id = ? AND a.status = 'completed'
       ORDER BY a.id ASC`,
      [attempt.exam_id, attempt.student_id]
    );

    const currentAttemptIdx = examAttempts.findIndex(a => a.id === Number(attemptId));
    const currentAttemptNumber = currentAttemptIdx >= 0 ? (currentAttemptIdx + 1) : 1;

    let comparison = null;

    if (currentAttemptIdx > 0) {
      // There is an older attempt for this same exam!
      const oldAttemptMeta = examAttempts[currentAttemptIdx - 1];
      const oldAttemptId = oldAttemptMeta.id;

      // Fetch old result record
      const oldResult = await get(
        `SELECT * FROM Results WHERE attempt_id = ?`,
        [oldAttemptId]
      );

      // Fetch old student answers
      const oldAnswers = await query(
        `SELECT sa.question_id, sa.selected_option, sa.is_correct, sa.marks_awarded, q.topic, q.marks
         FROM Student_Answers sa
         JOIN Questions q ON sa.question_id = q.id
         WHERE sa.attempt_id = ?`,
        [oldAttemptId]
      );

      const oldAnswersMap = {};
      oldAnswers.forEach(ans => {
        oldAnswersMap[ans.question_id] = ans;
      });

      // Calculate old time taken
      let oldTimeFormatted = 'N/A';
      if (oldAttemptMeta.start_time && oldAttemptMeta.end_time) {
        const sMs = parseDbDate(oldAttemptMeta.start_time);
        const eMs = parseDbDate(oldAttemptMeta.end_time);
        const oldTimeSec = Math.max(0, Math.floor((eMs - sMs) / 1000));
        const m = Math.floor(oldTimeSec / 60);
        const s = oldTimeSec % 60;
        oldTimeFormatted = `${m}m ${s}s`;
      }

      // Delta calculations
      const oldScore = Number(oldResult?.total_marks_obtained || 0);
      const newScore = Number(result.total_marks_obtained || 0);
      const scoreDelta = Math.round((newScore - oldScore) * 100) / 100;

      const oldPct = Number(oldResult?.percentage || 0);
      const newPct = Number(result.percentage || 0);
      const pctDelta = Math.round((newPct - oldPct) * 10) / 10;

      const oldAcc = Number(oldResult?.accuracy || 0);
      const newAcc = Number(result.accuracy || 0);
      const accDelta = Math.round((newAcc - oldAcc) * 10) / 10;

      const correctDelta = (result.correct_answers || 0) - (oldResult?.correct_answers || 0);

      // Question-by-question comparative matrix
      let improvedCount = 0;
      let maintainedCount = 0;
      let regressedCount = 0;
      let persistentErrorCount = 0;

      const questionComparisons = questionsAndAnswers.map(currQ => {
        const oldAns = oldAnswersMap[currQ.id] || null;
        const oldSelected = oldAns?.selected_option || null;
        const oldCorrect = oldAns ? oldAns.is_correct === 1 : false;

        const newSelected = currQ.selected_option || null;
        const newCorrect = currQ.is_correct === 1;

        let status = 'NEEDS_PRACTICE';
        let statusLabel = 'Persistent Mistake';
        let statusBadge = 'badge-error';

        if (!oldCorrect && newCorrect) {
          status = 'IMPROVED';
          statusLabel = '✨ Improved (+Mark)';
          statusBadge = 'badge-success';
          improvedCount++;
        } else if (oldCorrect && newCorrect) {
          status = 'MAINTAINED';
          statusLabel = '🌟 Retained Mastery';
          statusBadge = 'badge-success';
          maintainedCount++;
        } else if (oldCorrect && !newCorrect) {
          status = 'REGRESSED';
          statusLabel = '⚠️ Needs Review';
          statusBadge = 'badge-warning';
          regressedCount++;
        } else {
          status = 'NEEDS_PRACTICE';
          statusLabel = '❌ Still Incorrect';
          statusBadge = 'badge-error';
          persistentErrorCount++;
        }

        return {
          question_id: currQ.id,
          question_text: currQ.question_text,
          topic: currQ.topic,
          marks: currQ.marks,
          correct_option: currQ.correct_option,
          old_selected: oldSelected,
          old_is_correct: oldCorrect,
          new_selected: newSelected,
          new_is_correct: newCorrect,
          status,
          status_label: statusLabel,
          status_badge: statusBadge
        };
      });

      // Topic-by-topic comparison
      const oldTopicMap = {};
      oldAnswers.forEach(ans => {
        const top = ans.topic || 'General';
        if (!oldTopicMap[top]) {
          oldTopicMap[top] = { total_marks: 0, marks_obtained: 0 };
        }
        const qM = ans.marks != null ? Number(ans.marks) : 1;
        oldTopicMap[top].total_marks += qM;
        if (ans.is_correct === 1) {
          oldTopicMap[top].marks_obtained += (ans.marks_awarded != null ? Number(ans.marks_awarded) : qM);
        }
      });

      const topicComparison = topicBreakdown.map(tb => {
        const oldT = oldTopicMap[tb.topic] || { total_marks: tb.total_marks, marks_obtained: 0 };
        const oldTopicPct = oldT.total_marks > 0
          ? Math.round((oldT.marks_obtained / oldT.total_marks) * 1000) / 10
          : 0;
        const newTopicPct = tb.score_percentage;
        const topicDelta = Math.round((newTopicPct - oldTopicPct) * 10) / 10;

        return {
          topic: tb.topic,
          old_score_percentage: oldTopicPct,
          new_score_percentage: newTopicPct,
          delta_percentage: topicDelta
        };
      });

      // Comparative diagnostic narrative
      let growthNarrative = '';
      if (pctDelta > 0) {
        growthNarrative = `Great progress! Your score climbed from ${oldPct}% to ${newPct}% (+${pctDelta}% growth). You successfully converted ${improvedCount} previously missed question(s) into correct answers. Keep up the active learning!`;
      } else if (pctDelta === 0) {
        growthNarrative = `Stable performance! You matched your previous score of ${newPct}%. ${maintainedCount} question(s) maintained perfect accuracy. Focus on reviewing recurring mistakes to elevate your mastery.`;
      } else {
        growthNarrative = `Your score was ${oldPct}% previously and is now ${newPct}% (${pctDelta}% difference). Review the ${regressedCount} question(s) where answers deviated, and re-read foundational modules.`;
      }

      comparison = {
        has_comparison: true,
        is_first_attempt: false,
        old_attempt_id: oldAttemptId,
        old_attempt_number: currentAttemptNumber - 1,
        new_attempt_id: Number(attemptId),
        new_attempt_number: currentAttemptNumber,
        old_score: oldScore,
        new_score: newScore,
        score_delta: scoreDelta,
        old_percentage: oldPct,
        new_percentage: newPct,
        percentage_delta: pctDelta,
        old_accuracy: oldAcc,
        new_accuracy: newAcc,
        accuracy_delta: accDelta,
        old_correct: oldResult?.correct_answers || 0,
        new_correct: result.correct_answers || 0,
        correct_delta: correctDelta,
        old_incorrect: oldResult?.incorrect_answers || 0,
        new_incorrect: result.incorrect_answers || 0,
        old_time_formatted: oldTimeFormatted,
        new_time_formatted: timeTakenFormatted,
        improved_count: improvedCount,
        maintained_count: maintainedCount,
        regressed_count: regressedCount,
        persistent_error_count: persistentErrorCount,
        growth_narrative: growthNarrative,
        topic_comparison: topicComparison,
        question_comparisons: questionComparisons
      };
    } else {
      comparison = {
        has_comparison: false,
        is_first_attempt: true,
        current_attempt_number: 1,
        message: 'This is Attempt #1. Take a Re-Exam to unlock the Old vs. New Comparative Performance Analysis and track your growth side-by-side!'
      };
    }

    return res.json({
      success: true,
      result: {
        ...result,
        time_taken_formatted: timeTakenFormatted
      },
      student,
      exam,
      attempt,
      attempt_info: {
        current_attempt_number: currentAttemptNumber,
        total_completed_attempts: examAttempts.length,
        all_attempts: examAttempts.map((a, idx) => ({
          attempt_id: a.id,
          attempt_number: idx + 1,
          score: a.total_score,
          percentage: a.percentage,
          completed_at: a.completed_at
        }))
      },
      comparison,
      topic_breakdown: topicBreakdown,
      analysis: {
        overall_assessment: overallAssessment,
        strongest_topic: strongestTopic,
        weakest_topic: weakestTopic,
        improvement_topics: improvementTopics,
        recommendations: recommendations
      },
      historical_trends: historicalAttempts,
      questions_review: questionsAndAnswers
    });
  } catch (error) {
    console.error('Error in getResultByAttemptId:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve detailed examination result'
    });
  }
}

module.exports = {
  getMyResults,
  getResultByAttemptId
};
