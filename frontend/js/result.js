// EduQuest E-Learning Platform - Result & Comparative Performance Analytics

let attemptId = null;
let resultData = null;
let charts = {};

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    attemptId: params.get('attemptId')
  };
}

async function initResult() {
  const params = getUrlParams();
  attemptId = params.attemptId;

  if (!attemptId) {
    alert('No quiz attempt specified.');
    window.location.href = 'dashboard.html';
    return;
  }

  try {
    // Check auth
    const authRes = await fetch('/api/auth/me');
    if (!authRes.ok) {
      window.location.href = 'index.html';
      return;
    }
    const authData = await authRes.json();
    const user = authData.user;
    if (user) {
      document.getElementById('res-student-name').textContent = user.name || 'Learner';
      document.getElementById('res-student-enrollment').textContent = user.enrollment_no || '';
    }

    // Fetch Result Details with Comparative Analysis
    const res = await fetch(`/api/results/${attemptId}`);
    if (!res.ok) {
      throw new Error('Failed to retrieve quiz evaluation results.');
    }

    resultData = await res.json();
    renderSummary(resultData);
    renderAttemptSwitcher(resultData);
    renderComparison(resultData);
    renderAnalysis(resultData);
    renderQuestionReview(resultData);
    await initCharts(resultData);

  } catch (err) {
    console.error(err);
    alert('Error loading result: ' + err.message);
  }
}

function renderSummary(data) {
  const r = data.result || data;
  const exam = data.exam || {};
  const student = data.student || {};
  const attemptInfo = data.attempt_info || {};

  if (student.name) document.getElementById('res-student-name').textContent = student.name;
  if (student.enrollment_no) document.getElementById('res-student-enrollment').textContent = student.enrollment_no;

  document.getElementById('result-exam-title').textContent = exam.title || r.exam_title || 'Quiz Evaluation Result';
  document.getElementById('result-subject-badge').textContent = exam.subject || r.subject || 'General Assessment';

  const attemptBadge = document.getElementById('result-attempt-badge');
  if (attemptBadge) {
    const attNum = attemptInfo.current_attempt_number || 1;
    attemptBadge.textContent = attNum > 1 ? `Re-Exam (Attempt #${attNum})` : 'Attempt #1';
    attemptBadge.className = attNum > 1 ? 'badge badge-warning' : 'badge badge-neutral';
    attemptBadge.style.display = 'inline-block';
  }

  const completedTime = r.completed_at ? new Date(r.completed_at).toLocaleString() : new Date().toLocaleString();
  document.getElementById('res-completed-time').textContent = `Submitted: ${completedTime}`;

  const pct = Number(r.percentage || 0).toFixed(1);
  const accuracy = Number(r.accuracy || 0).toFixed(1);

  document.getElementById('card-score').textContent = `${r.total_marks_obtained || 0} / ${r.max_marks || 0}`;
  document.getElementById('card-percentage').textContent = `${pct}%`;
  document.getElementById('card-accuracy').textContent = `${accuracy}%`;
  document.getElementById('card-total').textContent = r.total_questions || 0;
  document.getElementById('card-attempted').textContent = r.attempted_questions || 0;
  document.getElementById('card-correct').textContent = r.correct_answers || 0;
  document.getElementById('card-incorrect').textContent = r.incorrect_answers || 0;
  document.getElementById('card-unanswered').textContent = r.unanswered_questions || 0;

  // Status badge
  const isPassed = Number(pct) >= 40;
  const statusBadge = document.getElementById('result-status-badge');
  if (statusBadge) {
    statusBadge.textContent = isPassed ? 'MASTERY ACHIEVED' : 'RETAKE RECOMMENDED';
    statusBadge.className = `badge ${isPassed ? 'badge-success' : 'badge-error'}`;
  }

  const gradeSub = document.getElementById('card-grade-sub');
  if (gradeSub) {
    if (pct >= 85) gradeSub.textContent = 'Excellent (Grade A)';
    else if (pct >= 70) gradeSub.textContent = 'Proficient (Grade B)';
    else if (pct >= 50) gradeSub.textContent = 'Competent (Grade C)';
    else gradeSub.textContent = 'Below Benchmark';
  }
}

function renderAttemptSwitcher(data) {
  const attemptInfo = data.attempt_info || {};
  const allAttempts = attemptInfo.all_attempts || [];
  const container = document.getElementById('attempt-switcher-container');
  const select = document.getElementById('attempt-select');

  if (!container || !select) return;

  if (allAttempts.length > 1) {
    select.innerHTML = allAttempts.map(a => {
      const isSelected = Number(a.attempt_id) === Number(attemptId);
      const pct = Number(a.percentage || 0).toFixed(1);
      return `<option value="${a.attempt_id}" ${isSelected ? 'selected' : ''}>Attempt #${a.attempt_number} (${pct}%)</option>`;
    }).join('');
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
}

function switchAttempt(newAttemptId) {
  if (newAttemptId && newAttemptId !== attemptId) {
    window.location.href = `result.html?attemptId=${newAttemptId}`;
  }
}

function renderComparison(data) {
  const comparison = data.comparison;
  const compSection = document.getElementById('comparison-section');
  const firstNotice = document.getElementById('first-attempt-notice');

  if (!compSection || !firstNotice) return;

  if (comparison && comparison.has_comparison) {
    compSection.style.display = 'block';
    firstNotice.style.display = 'none';

    // Header Title
    document.getElementById('comp-header-title').textContent = 
      `Attempt Comparison: Attempt #${comparison.new_attempt_number} (New) vs. Attempt #${comparison.old_attempt_number} (Old)`;

    // Diagnostic Growth Narrative
    document.getElementById('comp-growth-narrative').textContent = comparison.growth_narrative;

    // 1. Score KPI
    const maxMarks = data.exam?.max_marks || data.result?.max_marks || 10;
    document.getElementById('comp-score-old').textContent = `${comparison.old_score} / ${maxMarks}`;
    document.getElementById('comp-score-new').textContent = `${comparison.new_score} / ${maxMarks}`;

    const scoreDeltaEl = document.getElementById('comp-score-delta');
    const scoreDiff = comparison.score_delta;
    const isScoreUp = scoreDiff > 0;
    const isScoreEqual = scoreDiff === 0;

    scoreDeltaEl.innerHTML = `
      <span class="delta-badge ${isScoreUp ? 'delta-positive' : (isScoreEqual ? 'delta-neutral' : 'delta-negative')}">
        ${isScoreUp ? '+' : ''}${scoreDiff} Marks (${comparison.percentage_delta >= 0 ? '+' : ''}${comparison.percentage_delta}%) ${isScoreUp ? '📈' : (isScoreEqual ? '⚖️' : '📉')}
      </span>
    `;

    // 2. Percentage KPI
    document.getElementById('comp-pct-old').textContent = `${Number(comparison.old_percentage).toFixed(1)}%`;
    document.getElementById('comp-pct-new').textContent = `${Number(comparison.new_percentage).toFixed(1)}%`;
    const pctDiff = comparison.percentage_delta;
    document.getElementById('comp-pct-delta').innerHTML = `
      <span class="delta-badge ${pctDiff > 0 ? 'delta-positive' : (pctDiff === 0 ? 'delta-neutral' : 'delta-negative')}">
        ${pctDiff > 0 ? '+' : ''}${pctDiff}% Delta
      </span>
    `;

    // 3. Accuracy KPI
    document.getElementById('comp-acc-old').textContent = `${Number(comparison.old_accuracy).toFixed(1)}%`;
    document.getElementById('comp-acc-new').textContent = `${Number(comparison.new_accuracy).toFixed(1)}%`;
    const accDiff = comparison.accuracy_delta;
    document.getElementById('comp-acc-delta').innerHTML = `
      <span class="delta-badge ${accDiff > 0 ? 'delta-positive' : (accDiff === 0 ? 'delta-neutral' : 'delta-negative')}">
        ${accDiff > 0 ? '+' : ''}${accDiff}% Accuracy
      </span>
    `;

    // 4. Time KPI
    document.getElementById('comp-time-old').textContent = comparison.old_time_formatted || '--';
    document.getElementById('comp-time-new').textContent = comparison.new_time_formatted || '--';

    // Summary counts
    document.getElementById('comp-improved-badge').textContent = `✨ ${comparison.improved_count || 0} Questions Improved`;
    document.getElementById('comp-maintained-badge').textContent = `🌟 ${comparison.maintained_count || 0} Maintained Mastery`;
    const regressedBadge = document.getElementById('comp-regressed-badge');
    if (comparison.regressed_count > 0) {
      regressedBadge.textContent = `⚠️ ${comparison.regressed_count} Regressed`;
      regressedBadge.style.display = 'inline-block';
    } else {
      regressedBadge.style.display = 'none';
    }

    // Question-by-Question Comparative Matrix Table
    const tbody = document.getElementById('comp-questions-tbody');
    const qList = comparison.question_comparisons || [];

    if (qList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">No question comparison available.</td></tr>';
    } else {
      tbody.innerHTML = qList.map((q, idx) => {
        let oldBadge = '';
        if (q.old_selected) {
          oldBadge = q.old_is_correct
            ? `<span class="badge badge-success" style="font-size: 0.75rem;">✔️ Opt ${escapeHtml(q.old_selected)}</span>`
            : `<span class="badge badge-error" style="font-size: 0.75rem;">❌ Opt ${escapeHtml(q.old_selected)}</span>`;
        } else {
          oldBadge = `<span class="badge badge-neutral" style="font-size: 0.75rem;">⚪ Skipped</span>`;
        }

        let newBadge = '';
        if (q.new_selected) {
          newBadge = q.new_is_correct
            ? `<span class="badge badge-success" style="font-size: 0.75rem;">✔️ Opt ${escapeHtml(q.new_selected)}</span>`
            : `<span class="badge badge-error" style="font-size: 0.75rem;">❌ Opt ${escapeHtml(q.new_selected)}</span>`;
        } else {
          newBadge = `<span class="badge badge-neutral" style="font-size: 0.75rem;">⚪ Skipped</span>`;
        }

        let outcomeHtml = '';
        if (q.status === 'IMPROVED') {
          outcomeHtml = `<span class="badge matrix-status-improved">✨ Improved (+Mark)</span>`;
        } else if (q.status === 'MAINTAINED') {
          outcomeHtml = `<span class="badge matrix-status-maintained">🌟 Retained Mastery</span>`;
        } else if (q.status === 'REGRESSED') {
          outcomeHtml = `<span class="badge matrix-status-regressed">⚠️ Needs Review</span>`;
        } else {
          outcomeHtml = `<span class="badge matrix-status-error">❌ Persistent Mistake</span>`;
        }

        return `
          <tr>
            <td style="font-weight: 600;">${idx + 1}</td>
            <td>
              <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 0.2rem;">${escapeHtml(q.question_text)}</div>
              <small style="color: var(--text-secondary);">Correct Answer: <strong>Option ${escapeHtml(q.correct_option)}</strong></small>
            </td>
            <td><span class="badge" style="background: var(--bg-cream-tint); color: var(--text-secondary);">${escapeHtml(q.topic || 'General')}</span></td>
            <td style="text-align: center;">${oldBadge}</td>
            <td style="text-align: center;">${newBadge}</td>
            <td style="text-align: right;">${outcomeHtml}</td>
          </tr>
        `;
      }).join('');
    }

  } else {
    // First attempt -> show encouragement notice
    compSection.style.display = 'none';
    firstNotice.style.display = 'block';
  }
}

function retakeCurrentExam() {
  if (!resultData || !resultData.exam) {
    window.location.href = 'dashboard.html';
    return;
  }
  const exam = resultData.exam;
  const examCode = exam.exam_code || '';
  window.location.href = `exam.html?examId=${exam.id}&code=${encodeURIComponent(examCode)}&retake=1`;
}

function renderAnalysis(data) {
  const r = data.result || data;
  const analysis = data.analysis || {};
  const topicStats = data.topic_breakdown || [];
  const pct = Number(r.percentage || 0);

  // 1. Overall assessment
  let overall = analysis.overall_assessment || analysis.overall || '';
  if (!overall) {
    if (pct >= 80) {
      overall = `Outstanding performance! You achieved a solid score of ${pct.toFixed(1)}%, demonstrating comprehensive mastery of the module concepts and high accuracy.`;
    } else if (pct >= 60) {
      overall = `Proficient competency. You scored ${pct.toFixed(1)}%, reflecting strong baseline clarity with opportunities for targeted refinement in weaker domains.`;
    } else if (pct >= 40) {
      overall = `Passing benchmark attained (${pct.toFixed(1)}%). Core fundamentals are acknowledged, but taking a re-exam after revision will reinforce your confidence.`;
    } else {
      overall = `Performance was below the desired proficiency benchmark (${pct.toFixed(1)}%). Review foundational topics and retake the quiz to measure your growth!`;
    }
  }
  document.getElementById('analysis-overall').textContent = overall;

  // 2. Strongest topic
  let strongest = analysis.strongest_topic || '';
  if (!strongest && topicStats.length > 0) {
    const sorted = [...topicStats].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
    strongest = `${sorted[0].topic} (${Number(sorted[0].accuracy || 0).toFixed(1)}% accuracy)`;
  }
  document.getElementById('analysis-strongest').textContent = strongest || 'General Web Technologies';

  // 3. Weakest topic
  let weakest = analysis.weakest_topic || '';
  if (!weakest && topicStats.length > 0) {
    const sorted = [...topicStats].sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));
    weakest = `${sorted[0].topic} (${Number(sorted[0].accuracy || 0).toFixed(1)}% accuracy)`;
  }
  document.getElementById('analysis-weakest').textContent = weakest || 'None identified';

  // 4. Topics requiring improvement
  let improvement = '';
  if (Array.isArray(analysis.improvement_topics)) {
    improvement = analysis.improvement_topics.length > 0 ? analysis.improvement_topics.join(', ') : 'None. Performance was consistent across evaluated modules.';
  } else if (typeof analysis.improvement_needed === 'string') {
    improvement = analysis.improvement_needed;
  } else if (topicStats.length > 0) {
    const needy = topicStats.filter(t => (t.accuracy || 0) < 65).map(t => t.topic);
    improvement = needy.length > 0 ? needy.join(', ') : 'None. Performance was consistent across evaluated modules.';
  }
  document.getElementById('analysis-improvement').textContent = improvement || 'None';

  // 5. Suggestions & Recommendations
  let suggestions = '';
  if (Array.isArray(analysis.recommendations)) {
    suggestions = analysis.recommendations.join(' ');
  } else if (typeof analysis.suggestions === 'string') {
    suggestions = analysis.suggestions;
  } else {
    suggestions = 'Review the detailed question analysis below, revisit the syllabus documentation, and retake the quiz to solidify mastery.';
  }
  document.getElementById('analysis-suggestions').textContent = suggestions;
}

function renderQuestionReview(data) {
  const tbody = document.getElementById('question-review-tbody');
  const questions = data.questions_review || [];

  if (!questions || questions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">No question review data available.</td></tr>';
    return;
  }

  tbody.innerHTML = questions.map((q, idx) => {
    const selected = q.selected_option || 'None';
    const correct = q.correct_option || '-';
    const isCorrect = q.is_correct === 1;
    const isUnanswered = !q.selected_option;

    let outcomeBadge = '';
    if (isUnanswered) {
      outcomeBadge = '<span class="badge badge-neutral">UNANSWERED</span>';
    } else if (isCorrect) {
      outcomeBadge = '<span class="badge badge-success">CORRECT</span>';
    } else {
      outcomeBadge = '<span class="badge badge-error">INCORRECT</span>';
    }

    const marksStr = `${q.marks_awarded || 0} / ${q.marks || 1}`;

    return `
      <tr>
        <td style="font-weight: 600;">Q${idx + 1}</td>
        <td>
          <div style="font-weight: 500; margin-bottom: 0.25rem;">${escapeHtml(q.question_text)}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">
            Topic: <span class="badge" style="background: var(--bg-cream-tint); color: var(--text-secondary); text-transform: none;">${escapeHtml(q.topic || 'General')}</span>
          </div>
        </td>
        <td>
          <span style="font-weight: 600; color: ${isCorrect ? 'var(--success-color)' : (isUnanswered ? 'var(--text-secondary)' : 'var(--error-color)')};">
            Option ${escapeHtml(selected)}
          </span>
        </td>
        <td>
          <span style="font-weight: 600; color: var(--success-color);">
            Option ${escapeHtml(correct)}
          </span>
        </td>
        <td>${outcomeBadge}</td>
        <td style="text-align: right; font-weight: 600;">${marksStr}</td>
      </tr>
    `;
  }).join('');
}

async function initCharts(data) {
  const r = data.result || data;
  const topicStats = data.topic_breakdown || [];
  const comparison = data.comparison;

  // 1. Doughnut Chart: Response Breakdown
  const ctxBreakdown = document.getElementById('responseBreakdownChart')?.getContext('2d');
  if (ctxBreakdown) {
    if (charts.breakdown) charts.breakdown.destroy();
    charts.breakdown = new Chart(ctxBreakdown, {
      type: 'doughnut',
      data: {
        labels: ['Correct', 'Incorrect', 'Unanswered'],
        datasets: [{
          data: [r.correct_answers || 0, r.incorrect_answers || 0, r.unanswered_questions || 0],
          backgroundColor: ['#236B43', '#B53838', '#E5DCD0'],
          borderColor: '#FFFFFF',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 14, font: { family: 'inherit', size: 12 } } }
        }
      }
    });
  }

  // 2. Bar Chart: Topic-wise Performance (% score per topic)
  const ctxTopicScore = document.getElementById('topicScoreChart')?.getContext('2d');
  if (ctxTopicScore) {
    const labels = topicStats.map(t => t.topic);
    const scorePercentages = topicStats.map(t => Number(t.score_percentage || t.percentage || 0).toFixed(1));

    if (charts.topicScore) charts.topicScore.destroy();
    charts.topicScore = new Chart(ctxTopicScore, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['General'],
        datasets: [{
          label: '% Score Achieved',
          data: labels.length > 0 ? scorePercentages : [Number(r.percentage || 0).toFixed(1)],
          backgroundColor: '#332622',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)' } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // 3. Line Chart: Historical Trajectory
  const ctxHistory = document.getElementById('historicalPerformanceChart')?.getContext('2d');
  if (ctxHistory) {
    let historyLabels = [];
    let historyScores = [];

    if (data.historical_trends && Array.isArray(data.historical_trends) && data.historical_trends.length > 0) {
      historyLabels = data.historical_trends.map((h, i) => `${h.exam_title ? h.exam_title.substring(0, 16) : 'Quiz'} (#${i + 1})`);
      historyScores = data.historical_trends.map(h => Number(h.percentage || 0).toFixed(1));
    } else {
      historyLabels = ['Current Quiz'];
      historyScores = [Number(r.percentage || 0).toFixed(1)];
    }

    if (charts.history) charts.history.destroy();
    charts.history = new Chart(ctxHistory, {
      type: 'line',
      data: {
        labels: historyLabels,
        datasets: [{
          label: 'Performance Score (%)',
          data: historyScores,
          borderColor: '#C2672B',
          backgroundColor: 'rgba(194, 103, 43, 0.08)',
          fill: true,
          tension: 0.25,
          pointBackgroundColor: '#C2672B',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Score (%)' } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // 4. Horizontal Bar Chart: Topic Accuracy Percentage
  const ctxAccuracy = document.getElementById('topicAccuracyChart')?.getContext('2d');
  if (ctxAccuracy) {
    const labels = topicStats.map(t => t.topic);
    const accuracies = topicStats.map(t => Number(t.accuracy || 0).toFixed(1));

    if (charts.topicAccuracy) charts.topicAccuracy.destroy();
    charts.topicAccuracy = new Chart(ctxAccuracy, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['General'],
        datasets: [{
          label: 'Accuracy (%)',
          data: labels.length > 0 ? accuracies : [Number(r.accuracy || 0).toFixed(1)],
          backgroundColor: '#236B43',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, max: 100, title: { display: true, text: 'Accuracy (%)' } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // 5. SIDE-BY-SIDE TOPIC COMPARISON CHART (OLD VS NEW ATTEMPT)
  const ctxCompTopic = document.getElementById('topicComparisonChart')?.getContext('2d');
  if (ctxCompTopic && comparison && comparison.has_comparison) {
    const topicCompList = comparison.topic_comparison || [];
    const labels = topicCompList.map(t => t.topic);
    const oldScores = topicCompList.map(t => t.old_score_percentage);
    const newScores = topicCompList.map(t => t.new_score_percentage);

    if (charts.topicComparison) charts.topicComparison.destroy();
    charts.topicComparison = new Chart(ctxCompTopic, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['General'],
        datasets: [
          {
            label: 'Old Attempt Score (%)',
            data: labels.length > 0 ? oldScores : [comparison.old_percentage],
            backgroundColor: '#D4C7BA',
            borderRadius: 6
          },
          {
            label: 'New Attempt Score (%)',
            data: labels.length > 0 ? newScores : [comparison.new_percentage],
            backgroundColor: '#C2672B',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Score Percentage (%)' } }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 14, font: { family: 'inherit', size: 12 } }
          }
        }
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  initResult();
});
