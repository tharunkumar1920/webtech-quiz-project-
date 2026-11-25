const { get, query, run } = require('../database/db');

/**
 * Helper to safely parse SQLite timestamps as UTC
 */
function parseDbDate(dateStr) {
  if (!dateStr) return Date.now();
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
  }
  return new Date(dateStr).getTime();
}

/**
 * Get assigned exams for the logged-in student
 * GET /api/exams/my-exams
 */
async function getMyExams(req, res) {
  try {
    const studentId = req.session.user.id;

    // Fetch all assigned active exams
    const exams = await query(
      `SELECT
        e.id,
        e.title,
        e.subject,
        e.exam_code,
        e.duration_minutes,
        e.total_questions,
        e.max_marks,
        e.is_active,
        ea.assigned_at
       FROM Exam_Assignments ea
       JOIN Exams e ON ea.exam_id = e.id
       WHERE ea.student_id = ? AND e.is_active = 1
       ORDER BY e.created_at DESC`,
      [studentId]
    );

    const formattedExams = [];
    for (const exam of exams) {
      // Find active in-progress attempt
      const inProgressAttempt = await get(
        `SELECT id, start_time FROM Exam_Attempts WHERE exam_id = ? AND student_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1`,
        [exam.id, studentId]
      );

      // Find completed attempts
      const completedAttempts = await query(
        `SELECT a.id, a.total_score, a.end_time, r.id AS result_id, r.percentage, r.accuracy
         FROM Exam_Attempts a
         LEFT JOIN Results r ON r.attempt_id = a.id
         WHERE a.exam_id = ? AND a.student_id = ? AND a.status = 'completed'
         ORDER BY a.id DESC`,
        [exam.id, studentId]
      );

      const totalAttempts = completedAttempts.length;
      const latestCompleted = completedAttempts[0] || null;

      let status = 'not_started';
      let activeAttemptId = null;
      let activeResultId = null;
      let latestPercentage = null;
      let latestScore = null;

      if (inProgressAttempt) {
        status = 'in_progress';
        activeAttemptId = inProgressAttempt.id;
      } else if (latestCompleted) {
        status = 'completed';
        activeAttemptId = latestCompleted.id;
        activeResultId = latestCompleted.result_id;
        latestPercentage = latestCompleted.percentage;
        latestScore = latestCompleted.total_score;
      }

      formattedExams.push({
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        duration_minutes: exam.duration_minutes,
        total_questions: exam.total_questions,
        max_marks: exam.max_marks,
        assigned_at: exam.assigned_at,
        status: status,
        attempt_id: activeAttemptId,
        result_id: activeResultId,
        percentage: latestPercentage != null ? latestPercentage : null,
        latest_score: latestScore != null ? latestScore : null,
        attempts_count: totalAttempts,
        can_retake: true
      });
    }

    return res.json({
      success: true,
      exams: formattedExams
    });
  } catch (error) {
    console.error('Error in getMyExams:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve assigned examinations'
    });
  }
}

/**
 * Verify exam passcode for a student before starting or retaking
 * POST /api/exams/verify-code
 * Body: { exam_id, exam_code }
 */
async function verifyExamCode(req, res) {
  try {
    const studentId = req.session.user.id;
    const { exam_id, exam_code } = req.body;

    if (!exam_id || !exam_code) {
      return res.status(400).json({
        success: false,
        error: 'Exam ID and Exam Code are required'
      });
    }

    const exam = await get(
      `SELECT * FROM Exams WHERE id = ? AND is_active = 1`,
      [exam_id]
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Examination not found or is currently inactive'
      });
    }

    // Verify passcode match (case-insensitive trim)
    if (exam.exam_code.trim().toUpperCase() !== exam_code.trim().toUpperCase()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid examination code entered'
      });
    }

    // Verify student is assigned
    const assignment = await get(
      `SELECT * FROM Exam_Assignments WHERE exam_id = ? AND student_id = ?`,
      [exam_id, studentId]
    );

    if (!assignment) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to take this examination'
      });
    }

    // Check previous completed attempts to provide retake context
    const completedAttempts = await query(
      `SELECT id, total_score FROM Exam_Attempts WHERE exam_id = ? AND student_id = ? AND status = 'completed' ORDER BY id DESC`,
      [exam_id, studentId]
    );

    const isRetake = completedAttempts.length > 0;

    return res.json({
      success: true,
      message: isRetake
        ? `Passcode verified! Ready for Re-Exam (Attempt #${completedAttempts.length + 1})`
        : 'Examination passcode verified successfully',
      is_retake: isRetake,
      attempt_number: completedAttempts.length + 1,
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        duration_minutes: exam.duration_minutes,
        total_questions: exam.total_questions,
        max_marks: exam.max_marks
      }
    });
  } catch (error) {
    console.error('Error in verifyExamCode:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify examination passcode'
    });
  }
}

/**
 * Start or resume an examination attempt (supports Re-Exam / Retakes)
 * POST /api/exams/start
 * Body: { exam_id, exam_code, attempt_id, retake }
 */
async function startExam(req, res) {
  try {
    const studentId = req.session.user.id;
    let { exam_id, exam_code, attempt_id, retake } = req.body;

    // Support resuming via attempt_id if exam_id is omitted
    if (!exam_id && attempt_id) {
      const attemptRow = await get(
        `SELECT exam_id FROM Exam_Attempts WHERE id = ? AND student_id = ?`,
        [attempt_id, studentId]
      );
      if (attemptRow) {
        exam_id = attemptRow.exam_id;
      }
    }

    if (!exam_id) {
      return res.status(400).json({
        success: false,
        error: 'Exam ID is required'
      });
    }

    const exam = await get(
      `SELECT * FROM Exams WHERE id = ? AND is_active = 1`,
      [exam_id]
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Examination not found or is currently inactive'
      });
    }

    // Verify assignment
    const assignment = await get(
      `SELECT * FROM Exam_Assignments WHERE exam_id = ? AND student_id = ?`,
      [exam_id, studentId]
    );

    if (!assignment) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to take this examination'
      });
    }

    // Look for an existing in-progress attempt to resume, unless an explicit new retake is requested with a valid code
    let attempt = null;

    if (attempt_id) {
      attempt = await get(
        `SELECT * FROM Exam_Attempts WHERE id = ? AND student_id = ? AND status = 'in_progress'`,
        [attempt_id, studentId]
      );
    }

    if (!attempt && !retake) {
      attempt = await get(
        `SELECT * FROM Exam_Attempts WHERE exam_id = ? AND student_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1`,
        [exam_id, studentId]
      );
    }

    // If no in-progress attempt to resume, verify passcode and create a new attempt (supports re-exams)
    if (!attempt) {
      if (!exam_code || exam.exam_code.trim().toUpperCase() !== exam_code.trim().toUpperCase()) {
        return res.status(400).json({
          success: false,
          error: 'Valid examination code is required to start'
        });
      }

      const nowIso = new Date().toISOString();
      const createRes = await run(
        `INSERT INTO Exam_Attempts (exam_id, student_id, start_time, status) VALUES (?, ?, ?, 'in_progress')`,
        [exam_id, studentId, nowIso]
      );

      attempt = await get(`SELECT * FROM Exam_Attempts WHERE id = ?`, [createRes.id]);
    }

    // Count attempt index
    const prevAttempts = await get(
      `SELECT COUNT(*) AS cnt FROM Exam_Attempts WHERE exam_id = ? AND student_id = ? AND id < ?`,
      [exam_id, studentId, attempt.id]
    );
    const attemptNumber = (parseInt(prevAttempts?.cnt, 10) || 0) + 1;

    // Calculate remaining seconds
    const startTimeMs = parseDbDate(attempt.start_time);
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000));
    const totalSeconds = exam.duration_minutes * 60;
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

    // Fetch questions WITHOUT correct_option for test security
    const questions = await query(
      `SELECT id, exam_id, question_text, option_a, option_b, option_c, option_d, marks, topic
       FROM Questions WHERE exam_id = ? ORDER BY id ASC`,
      [exam_id]
    );

    // Fetch any previously saved answers for this attempt
    const savedAnswers = await query(
      `SELECT question_id, selected_option, is_marked_for_review
       FROM Student_Answers WHERE attempt_id = ?`,
      [attempt.id]
    );

    const answersMap = {};
    savedAnswers.forEach((ans) => {
      answersMap[ans.question_id] = {
        selected_option: ans.selected_option,
        is_marked_for_review: ans.is_marked_for_review === 1
      };
    });

    return res.json({
      success: true,
      attempt: {
        id: attempt.id,
        exam_id: exam.id,
        attempt_number: attemptNumber,
        is_retake: attemptNumber > 1,
        start_time: attempt.start_time,
        duration_minutes: exam.duration_minutes,
        remaining_seconds: remainingSeconds
      },
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        duration_minutes: exam.duration_minutes,
        total_questions: questions.length,
        max_marks: exam.max_marks
      },
      questions,
      saved_answers: answersMap
    });
  } catch (error) {
    console.error('Error in startExam:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start examination session'
    });
  }
}

/**
 * Save / autosave student answer for a question
 * POST /api/exams/save-answer
 * Body: { attempt_id, question_id, selected_option, is_marked_for_review }
 */
async function saveAnswer(req, res) {
  try {
    const studentId = req.session.user.id;
    const { attempt_id, question_id, selected_option, is_marked_for_review } = req.body;

    if (!attempt_id || !question_id) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID and Question ID are required'
      });
    }

    // Verify attempt ownership and in_progress status
    const attempt = await get(
      `SELECT a.*, e.duration_minutes
       FROM Exam_Attempts a
       JOIN Exams e ON a.exam_id = e.id
       WHERE a.id = ? AND a.student_id = ?`,
      [attempt_id, studentId]
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Examination attempt not found or not authorized'
      });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update answers for an examination that is already submitted'
      });
    }

    // Check server-side time with a generous 90-second network buffer
    const startTimeMs = parseDbDate(attempt.start_time);
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000));
    const maxAllowedSeconds = attempt.duration_minutes * 60 + 90;

    if (elapsedSeconds > maxAllowedSeconds) {
      return res.status(400).json({
        success: false,
        error: 'Exam duration has expired. Please submit your examination.'
      });
    }

    // Verify question belongs to this exam
    const question = await get(
      `SELECT id FROM Questions WHERE id = ? AND exam_id = ?`,
      [question_id, attempt.exam_id]
    );

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question does not belong to this examination'
      });
    }

    // Normalize option
    let cleanOption = null;
    if (typeof selected_option === 'string') {
      const upper = selected_option.trim().toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upper)) {
        cleanOption = upper;
      }
    }

    const reviewFlag = is_marked_for_review ? 1 : 0;

    // Upsert into Student_Answers
    await run(
      `INSERT INTO Student_Answers (attempt_id, question_id, selected_option, is_marked_for_review)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(attempt_id, question_id) DO UPDATE SET
         selected_option = excluded.selected_option,
         is_marked_for_review = excluded.is_marked_for_review`,
      [attempt_id, question_id, cleanOption, reviewFlag]
    );

    return res.json({
      success: true,
      message: 'Answer saved successfully'
    });
  } catch (error) {
    console.error('Error in saveAnswer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save answer'
    });
  }
}

/**
 * Submit exam, evaluate score server-side, record Result, lock attempt
 * POST /api/exams/submit
 * Body: { attempt_id }
 */
async function submitExam(req, res) {
  try {
    const studentId = req.session.user.id;
    const { attempt_id } = req.body;

    if (!attempt_id) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    // Verify attempt ownership
    const attempt = await get(
      `SELECT a.*, e.duration_minutes, e.max_marks AS exam_max_marks
       FROM Exam_Attempts a
       JOIN Exams e ON a.exam_id = e.id
       WHERE a.id = ? AND a.student_id = ?`,
      [attempt_id, studentId]
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'Examination attempt not found or not authorized'
      });
    }

    // Prevent resubmission
    if (attempt.status === 'completed') {
      const existingResult = await get(
        `SELECT id FROM Results WHERE attempt_id = ?`,
        [attempt_id]
      );
      return res.json({
        success: true,
        message: 'Examination has already been submitted',
        attempt_id: attempt.id,
        result_id: existingResult ? existingResult.id : null
      });
    }

    // Retrieve all questions with correct answers for grading
    const questions = await query(
      `SELECT id, correct_option, marks, topic FROM Questions WHERE exam_id = ?`,
      [attempt.exam_id]
    );

    // Retrieve student answers for this attempt
    const studentAnswers = await query(
      `SELECT * FROM Student_Answers WHERE attempt_id = ?`,
      [attempt_id]
    );

    const answersMap = new Map();
    studentAnswers.forEach((ans) => {
      answersMap.set(ans.question_id, ans);
    });

    let total_questions = questions.length;
    let attempted_questions = 0;
    let correct_answers = 0;
    let incorrect_answers = 0;
    let unanswered_questions = 0;
    let total_marks_obtained = 0;
    let calculated_max_marks = 0;

    for (const q of questions) {
      const qMarks = q.marks != null ? Number(q.marks) : 1.0;
      calculated_max_marks += qMarks;

      const studentAns = answersMap.get(q.id);
      const selected = studentAns && studentAns.selected_option
        ? studentAns.selected_option.trim().toUpperCase()
        : null;

      if (selected && ['A', 'B', 'C', 'D'].includes(selected)) {
        attempted_questions++;
        if (selected === q.correct_option.trim().toUpperCase()) {
          correct_answers++;
          total_marks_obtained += qMarks;
          await run(
            `UPDATE Student_Answers SET is_correct = 1, marks_awarded = ? WHERE attempt_id = ? AND question_id = ?`,
            [qMarks, attempt_id, q.id]
          );
        } else {
          incorrect_answers++;
          await run(
            `UPDATE Student_Answers SET is_correct = 0, marks_awarded = 0 WHERE attempt_id = ? AND question_id = ?`,
            [attempt_id, q.id]
          );
        }
      } else {
        unanswered_questions++;
        if (!studentAns) {
          await run(
            `INSERT INTO Student_Answers (attempt_id, question_id, selected_option, is_correct, marks_awarded, is_marked_for_review)
             VALUES (?, ?, NULL, 0, 0, 0)`,
            [attempt_id, q.id]
          );
        } else {
          await run(
            `UPDATE Student_Answers SET is_correct = 0, marks_awarded = 0 WHERE attempt_id = ? AND question_id = ?`,
            [attempt_id, q.id]
          );
        }
      }
    }

    const max_marks = calculated_max_marks > 0 ? calculated_max_marks : attempt.exam_max_marks;
    const finalScore = Math.round(total_marks_obtained * 100) / 100;
    const percentage = max_marks > 0 ? Math.round((finalScore / max_marks) * 10000) / 100 : 0;
    const accuracy = attempted_questions > 0 ? Math.round((correct_answers / attempted_questions) * 10000) / 100 : 0;
    const nowIso = new Date().toISOString();

    // Mark attempt as completed
    await run(
      `UPDATE Exam_Attempts SET status = 'completed', end_time = ?, total_score = ? WHERE id = ?`,
      [nowIso, finalScore, attempt_id]
    );

    // Save into Results table
    const resultRes = await run(
      `INSERT INTO Results (
        attempt_id, student_id, exam_id,
        total_questions, attempted_questions, correct_answers, incorrect_answers, unanswered_questions,
        total_marks_obtained, max_marks, percentage, accuracy, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attempt_id,
        studentId,
        attempt.exam_id,
        total_questions,
        attempted_questions,
        correct_answers,
        incorrect_answers,
        unanswered_questions,
        finalScore,
        max_marks,
        percentage,
        accuracy,
        nowIso
      ]
    );

    return res.json({
      success: true,
      message: 'Examination submitted and evaluated successfully',
      attempt_id: attempt_id,
      result_id: resultRes.id,
      summary: {
        total_questions,
        attempted_questions,
        correct_answers,
        incorrect_answers,
        unanswered_questions,
        total_marks_obtained: finalScore,
        max_marks,
        percentage,
        accuracy
      }
    });
  } catch (error) {
    console.error('Error in submitExam:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit examination'
    });
  }
}

module.exports = {
  getMyExams,
  verifyExamCode,
  startExam,
  saveAnswer,
  submitExam
};
