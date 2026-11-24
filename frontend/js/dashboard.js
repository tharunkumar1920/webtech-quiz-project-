// EduQuest E-Learning Platform - Learner Dashboard Logic

let currentUser = null;
let currentExamToStart = null;

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = 'index.html';
      return null;
    }
    const data = await res.json();
    const user = data.user;
    const role = user?.role || data.role;
    if (role !== 'student' || !user) {
      window.location.href = 'index.html';
      return null;
    }
    currentUser = user;
    renderProfile(currentUser);
    return currentUser;
  } catch (err) {
    window.location.href = 'index.html';
    return null;
  }
}

function renderProfile(user) {
  document.getElementById('nav-student-name').textContent = user.name || 'Learner';
  document.getElementById('nav-student-enrollment').textContent = user.enrollment_no || '';
  document.getElementById('profile-name').textContent = user.name || '-';
  document.getElementById('profile-enrollment').textContent = user.enrollment_no || '-';
  document.getElementById('profile-dept').textContent = user.department || 'General Learning';
  document.getElementById('profile-course').textContent = user.course || 'Interactive Modules';
  document.getElementById('profile-semester').textContent = user.semester ? `Semester ${user.semester}` : 'Level 1';
}

async function loadAssignedExams() {
  const container = document.getElementById('exams-container');
  try {
    const res = await fetch('/api/exams/my-exams');
    if (!res.ok) throw new Error('Failed to load quizzes.');
    const resData = await res.json();
    const exams = Array.isArray(resData) ? resData : (resData.exams || []);

    if (!exams || exams.length === 0) {
      container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: #FFFFFF;">
          <p style="color: var(--text-secondary); font-size: 1rem;">No quizzes currently assigned to your learning track.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = exams.map(exam => {
      const isCompleted = exam.status === 'completed';
      const isInProgress = exam.status === 'in_progress';
      const attemptsCount = exam.attempts_count || (isCompleted ? 1 : 0);

      let actionHtml = '';
      let statusBadge = '';

      if (isCompleted) {
        statusBadge = `<span class="badge badge-success">Completed (${attemptsCount} Attempt${attemptsCount === 1 ? '' : 's'})</span>`;
        const scoreText = exam.latest_score != null ? `${exam.latest_score} / ${exam.max_marks}` : '-';
        const pctText = exam.percentage != null ? `${Number(exam.percentage).toFixed(1)}%` : '';

        actionHtml = `
          <div style="background: var(--bg-cream-soft); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 0.85rem;">
            <div style="font-size: 0.78rem; color: var(--text-secondary);">Latest Score:</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">
              ${scoreText} <span style="font-size: 0.85rem; font-weight: 600; color: var(--btn-accent);">(${pctText})</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <a href="result.html?attemptId=${exam.attempt_id || exam.result_id || exam.id}" class="btn btn-secondary btn-block">
              📊 View Results & Analysis
            </a>
            <button class="btn btn-accent btn-block" onclick="openExamModal(${exam.id}, '${escapeHtml(exam.title)}', ${exam.duration_minutes}, ${exam.total_questions}, ${exam.max_marks}, true, '${escapeHtml(exam.exam_code || '')}')">
              🔄 Retake Quiz (Re-Exam)
            </button>
          </div>
        `;
      } else if (isInProgress) {
        statusBadge = '<span class="badge badge-warning">In Progress</span>';
        actionHtml = `
          <a href="exam.html?attemptId=${exam.attempt_id}&examId=${exam.id}" class="btn btn-primary btn-block">
            Resume Quiz &rarr;
          </a>
        `;
      } else {
        statusBadge = '<span class="badge badge-neutral">Scheduled</span>';
        actionHtml = `
          <button class="btn btn-primary btn-block" onclick="openExamModal(${exam.id}, '${escapeHtml(exam.title)}', ${exam.duration_minutes}, ${exam.total_questions}, ${exam.max_marks}, false, '${escapeHtml(exam.exam_code || '')}')">
            Start Quiz &rarr;
          </button>
        `;
      }

      return `
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-subtle); border-radius: var(--radius-md); background: #FFFFFF; transition: transform 0.15s, box-shadow 0.15s;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <span class="badge" style="background: var(--bg-cream-tint); color: var(--text-primary); font-weight: 600; border: 1px solid var(--border-color);">
                ${escapeHtml(exam.subject || 'General')}
              </span>
              ${statusBadge}
            </div>
            <h3 style="font-size: 1.18rem; margin-bottom: 0.5rem; color: var(--text-primary); line-height: 1.35;">
              ${escapeHtml(exam.title)}
            </h3>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.35rem;">
              <div>⏱️ Duration: <strong>${exam.duration_minutes} minutes</strong></div>
              <div>📝 Total Questions: <strong>${exam.total_questions}</strong></div>
              <div>🎯 Max Marks: <strong>${exam.max_marks}</strong></div>
            </div>
          </div>
          <div>
            ${actionHtml}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
        <p style="color: var(--error-color);">Error loading quizzes: ${err.message}</p>
      </div>
    `;
  }
}

async function loadResultsHistory() {
  const tbody = document.getElementById('results-table-body');
  try {
    const res = await fetch('/api/results/my-results');
    if (!res.ok) throw new Error('Failed to load past results.');
    const resData = await res.json();
    const results = Array.isArray(resData) ? resData : (resData.results || []);

    if (!results || results.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
            No completed quizzes recorded yet. Start a quiz above!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = results.map(r => {
      const dateStr = r.completed_at ? new Date(r.completed_at).toLocaleDateString() + ' ' + new Date(r.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
      const pct = r.percentage !== undefined ? `${Number(r.percentage).toFixed(1)}%` : '-';
      const score = `${r.total_marks_obtained || 0} / ${r.max_marks || 0}`;
      const isPassed = (r.percentage || 0) >= 40;

      return `
        <tr>
          <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(r.exam_title || r.title || 'Course Quiz')}</td>
          <td><span class="badge" style="background: var(--bg-cream-tint); color: var(--text-secondary);">${escapeHtml(r.exam_subject || r.subject || 'General')}</span></td>
          <td>${dateStr}</td>
          <td><strong>${score}</strong></td>
          <td><strong>${pct}</strong></td>
          <td>
            <span class="badge ${isPassed ? 'badge-success' : 'badge-error'}">
              ${isPassed ? 'PASSED' : 'RETAKE SUGGESTED'}
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <a href="result.html?attemptId=${r.attempt_id || r.id}" class="btn btn-secondary btn-sm" style="margin-right: 0.35rem;">
              View Report
            </a>
            <button class="btn btn-accent btn-sm" onclick="triggerRetakeFromHistory(${r.exam_id}, '${escapeHtml(r.exam_title || 'Quiz')}', ${r.duration_minutes || 30}, ${r.total_questions || 10}, ${r.max_marks || 10})">
              🔄 Retake
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--error-color);">
          Error loading past results: ${err.message}
        </td>
      </tr>
    `;
  }
}

function triggerRetakeFromHistory(examId, title, duration, questions, marks) {
  openExamModal(examId, title, duration, questions, marks, true);
}

function openExamModal(id, title, duration, questions, marks, isRetake = false, prefillCode = '') {
  currentExamToStart = { id, title, duration, questions, marks, isRetake };
  
  document.getElementById('modal-exam-title').textContent = isRetake ? `Re-Exam: ${title}` : title;
  document.getElementById('modal-duration').textContent = duration;
  document.getElementById('modal-questions').textContent = questions;
  document.getElementById('modal-marks').textContent = marks;

  const retakeBanner = document.getElementById('modal-retake-banner');
  if (retakeBanner) {
    retakeBanner.style.display = isRetake ? 'block' : 'none';
  }

  const startBtn = document.getElementById('modal-start-btn');
  if (startBtn) {
    startBtn.textContent = isRetake ? 'Verify & Begin Re-Exam' : 'Verify & Begin Quiz';
  }

  const passcodeInput = document.getElementById('exam-passcode-input');
  passcodeInput.value = prefillCode || '';

  const alertBox = document.getElementById('modal-code-alert');
  alertBox.style.display = 'none';

  document.getElementById('exam-code-modal').classList.add('show');
}

function closeExamModal() {
  document.getElementById('exam-code-modal').classList.remove('show');
  currentExamToStart = null;
}

async function handleStartExam(event) {
  event.preventDefault();
  if (!currentExamToStart) return;

  const codeInput = document.getElementById('exam-passcode-input');
  const code = codeInput.value.trim();
  const alertBox = document.getElementById('modal-code-alert');
  const submitBtn = document.getElementById('modal-start-btn');

  alertBox.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying Passcode...';

  try {
    const res = await fetch('/api/exams/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_id: currentExamToStart.id,
        exam_code: code
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to verify quiz passcode.');
    }

    // Direct redirect to live exam interface with retake flag
    const retakeParam = currentExamToStart.isRetake ? '&retake=1' : '';
    window.location.href = `exam.html?examId=${currentExamToStart.id}&code=${encodeURIComponent(code)}${retakeParam}`;
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = currentExamToStart?.isRetake ? 'Verify & Begin Re-Exam' : 'Verify & Begin Quiz';
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = 'index.html';
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

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (user) {
    await loadAssignedExams();
    await loadResultsHistory();
  }
});
