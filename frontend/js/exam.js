// University Examination Portal - Exam Interface Logic

let attemptId = null;
let examId = null;
let examData = null;
let questions = [];
let currentIndex = 0;
let studentAnswers = {}; // map: questionId -> { selected_option: string|null, is_marked_for_review: boolean }
let timerInterval = null;
let remainingSeconds = 0;
let isSubmitting = false;

// Extract URL query params
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    attemptId: params.get('attemptId'),
    examId: params.get('examId'),
    code: params.get('code'),
    retake: params.get('retake') === '1'
  };
}

async function initExam() {
  const params = getUrlParams();
  attemptId = params.attemptId;
  examId = params.examId;

  // Check student auth
  try {
    const authRes = await fetch('/api/auth/me');
    if (!authRes.ok) {
      window.location.href = 'index.html';
      return;
    }
    const authData = await authRes.json();
    const user = authData.user;
    const role = user?.role || authData.role;
    if (role !== 'student' || !user) {
      window.location.href = 'index.html';
      return;
    }
    document.getElementById('student-enrollment-display').textContent = user.enrollment_no || '';
    document.getElementById('student-name-display').textContent = user.name || 'Candidate';
  } catch (err) {
    window.location.href = 'index.html';
    return;
  }

  // Load exam and question data
  try {
    let payload = {};
    if (attemptId) payload.attempt_id = attemptId;
    if (examId) payload.exam_id = examId;
    if (params.code) payload.exam_code = params.code;
    if (params.retake) payload.retake = true;

    const res = await fetch('/api/exams/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || data.error || 'Failed to initialize examination session.');
      window.location.href = 'dashboard.html';
      return;
    }

    examData = data.exam || {};
    attemptId = data.attempt?.id || data.attemptId || attemptId;
    questions = data.questions || [];

    if (questions.length === 0) {
      alert('This examination contains no questions.');
      window.location.href = 'dashboard.html';
      return;
    }

    // Set attempt number badge if available
    const attemptBadge = document.getElementById('attempt-badge');
    if (attemptBadge) {
      const attNum = data.attempt?.attempt_number || 1;
      if (attNum > 1) {
        attemptBadge.textContent = `🔄 Re-Exam (Attempt #${attNum})`;
        attemptBadge.className = 'badge badge-warning';
        attemptBadge.style.display = 'inline-block';
      } else {
        attemptBadge.textContent = 'Attempt #1';
        attemptBadge.className = 'badge badge-neutral';
        attemptBadge.style.display = 'inline-block';
      }
    }

    document.getElementById('exam-title-display').textContent = examData.title || 'Examination';

    // Populate existing saved answers from backend
    if (data.saved_answers) {
      if (Array.isArray(data.saved_answers)) {
        data.saved_answers.forEach(a => {
          studentAnswers[a.question_id] = {
            selected_option: a.selected_option ? a.selected_option.toUpperCase() : null,
            is_marked_for_review: !!a.is_marked_for_review
          };
        });
      } else if (typeof data.saved_answers === 'object') {
        Object.keys(data.saved_answers).forEach(qid => {
          const item = data.saved_answers[qid];
          studentAnswers[qid] = {
            selected_option: item.selected_option ? item.selected_option.toUpperCase() : null,
            is_marked_for_review: !!item.is_marked_for_review
          };
        });
      }
    }

    // Check localStorage cache
    const cachedAnswers = localStorage.getItem(`exam_answers_${attemptId}`);
    if (cachedAnswers) {
      try {
        const parsed = JSON.parse(cachedAnswers);
        studentAnswers = { ...studentAnswers, ...parsed };
      } catch (e) {}
    }

    // Setup Timer
    if (data.attempt && typeof data.attempt.remaining_seconds === 'number') {
      remainingSeconds = Math.max(0, data.attempt.remaining_seconds);
    } else {
      const durationMinutes = examData.duration_minutes || 60;
      const startTimeStr = data.attempt?.start_time;
      if (startTimeStr) {
        const startTime = new Date(startTimeStr).getTime();
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        remainingSeconds = Math.max(0, (durationMinutes * 60) - elapsedSeconds);
      } else {
        remainingSeconds = durationMinutes * 60;
      }
    }

    startTimer();
    renderPalette();
    loadQuestion(0);

  } catch (err) {
    alert('Network error loading examination: ' + err.message);
    window.location.href = 'dashboard.html';
  }
}

// Countdown timer
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      alert('Time has expired! Submitting your examination automatically now.');
      submitExamFinal(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const formatted = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');

  const timerEl = document.getElementById('timer-display');
  const timerBox = document.getElementById('timer-box');
  if (timerEl) timerEl.textContent = formatted;

  if (remainingSeconds < 300) { // < 5 minutes
    timerBox?.classList.add('timer-warning');
  }
}

// Render Palette Grid
function renderPalette() {
  const container = document.getElementById('palette-grid-container');
  container.innerHTML = '';

  let answeredCount = 0;
  let markedCount = 0;
  let unansweredCount = 0;

  questions.forEach((q, idx) => {
    const ans = studentAnswers[q.id];
    const isAnswered = ans && ans.selected_option;
    const isMarked = ans && ans.is_marked_for_review;

    if (isAnswered) answeredCount++;
    if (isMarked) markedCount++;
    if (!isAnswered) unansweredCount++;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-btn';
    btn.textContent = idx + 1;
    btn.onclick = () => navigateToQuestion(idx);

    if (idx === currentIndex) {
      btn.classList.add('palette-current');
    }
    if (isAnswered) {
      btn.classList.add('palette-answered');
    } else if (isMarked) {
      btn.classList.add('palette-marked');
    }

    container.appendChild(btn);
  });

  document.getElementById('count-answered').textContent = answeredCount;
  document.getElementById('count-unanswered').textContent = unansweredCount;
  document.getElementById('count-marked').textContent = markedCount;
}

// Load Question at Index
function loadQuestion(index) {
  if (index < 0 || index >= questions.length) return;
  currentIndex = index;

  const q = questions[currentIndex];
  document.getElementById('question-num-label').textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  document.getElementById('question-topic-label').textContent = q.topic || 'General';
  document.getElementById('question-marks-label').textContent = q.marks || 1;
  document.getElementById('question-text-content').textContent = q.question_text;

  // Options
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.innerHTML = '';

  const savedAnswer = studentAnswers[q.id] || { selected_option: null, is_marked_for_review: false };

  const options = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d }
  ];

  options.forEach(opt => {
    if (!opt.text) return;
    const isSelected = (savedAnswer.selected_option || '').toUpperCase() === opt.key;

    const optDiv = document.createElement('div');
    optDiv.className = `option-item ${isSelected ? 'selected' : ''}`;
    optDiv.onclick = () => selectOption(opt.key);

    optDiv.innerHTML = `
      <input type="radio" name="exam_option" id="opt_${opt.key}" value="${opt.key}" ${isSelected ? 'checked' : ''}>
      <label class="option-label" for="opt_${opt.key}">
        <strong>${opt.key}.</strong> ${escapeHtml(opt.text)}
      </label>
    `;

    optionsContainer.appendChild(optDiv);
  });

  // Update Review Button state
  const reviewBtn = document.getElementById('mark-review-btn');
  if (savedAnswer.is_marked_for_review) {
    reviewBtn.textContent = 'Unmark Review';
    reviewBtn.className = 'btn btn-purple';
  } else {
    reviewBtn.textContent = 'Mark for Review';
    reviewBtn.className = 'btn btn-secondary';
  }

  // Previous button disable check
  document.getElementById('prev-question-btn').disabled = currentIndex === 0;

  // Next or Final question label
  const nextBtn = document.getElementById('save-next-btn');
  if (currentIndex === questions.length - 1) {
    nextBtn.textContent = 'Save & Review';
  } else {
    nextBtn.textContent = 'Save & Next →';
  }

  renderPalette();
}

// Select an option
function selectOption(optionKey) {
  const q = questions[currentIndex];
  if (!studentAnswers[q.id]) {
    studentAnswers[q.id] = { selected_option: null, is_marked_for_review: false };
  }
  studentAnswers[q.id].selected_option = optionKey.toUpperCase();

  // Sync to local and backend
  syncAnswer(q.id);
  loadQuestion(currentIndex);
}

// Clear selected option
function clearSelectedOption() {
  const q = questions[currentIndex];
  if (studentAnswers[q.id]) {
    studentAnswers[q.id].selected_option = null;
    syncAnswer(q.id);
    loadQuestion(currentIndex);
  }
}

// Toggle mark for review
function toggleMarkForReview() {
  const q = questions[currentIndex];
  if (!studentAnswers[q.id]) {
    studentAnswers[q.id] = { selected_option: null, is_marked_for_review: false };
  }
  studentAnswers[q.id].is_marked_for_review = !studentAnswers[q.id].is_marked_for_review;
  syncAnswer(q.id);
  loadQuestion(currentIndex);
}

// Sync answer to backend and localStorage
async function syncAnswer(questionId) {
  const answer = studentAnswers[questionId];
  if (!answer) return;

  // Update localStorage
  try {
    localStorage.setItem(`exam_answers_${attemptId}`, JSON.stringify(studentAnswers));
  } catch (e) {}

  // Server autosave
  try {
    await fetch('/api/exams/save-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attempt_id: parseInt(attemptId, 10),
        question_id: parseInt(questionId, 10),
        selected_option: answer.selected_option || null,
        is_marked_for_review: !!answer.is_marked_for_review
      })
    });
  } catch (err) {
    console.warn('Autosave warning:', err);
  }
}

function navigateQuestion(delta) {
  const nextIdx = currentIndex + delta;
  if (nextIdx >= 0 && nextIdx < questions.length) {
    loadQuestion(nextIdx);
  }
}

function navigateToQuestion(idx) {
  loadQuestion(idx);
}

function saveAndNext() {
  if (currentIndex < questions.length - 1) {
    navigateQuestion(1);
  } else {
    openSubmitModal();
  }
}

// Confirmation modal
function openSubmitModal() {
  let answered = 0;
  let marked = 0;
  let unanswered = 0;

  questions.forEach(q => {
    const ans = studentAnswers[q.id];
    if (ans && ans.selected_option) answered++;
    else unanswered++;
    if (ans && ans.is_marked_for_review) marked++;
  });

  document.getElementById('modal-summary-total').textContent = questions.length;
  document.getElementById('modal-summary-answered').textContent = answered;
  document.getElementById('modal-summary-unanswered').textContent = unanswered;
  document.getElementById('modal-summary-marked').textContent = marked;
  document.getElementById('submit-error-alert').style.display = 'none';

  document.getElementById('submit-confirm-modal').classList.add('show');
}

function closeSubmitModal() {
  document.getElementById('submit-confirm-modal').classList.remove('show');
}

// Final Submit
async function submitExamFinal(isAutoSubmit = false) {
  if (isSubmitting) return;
  isSubmitting = true;

  const submitBtn = document.getElementById('confirm-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  try {
    clearInterval(timerInterval);

    const res = await fetch('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attempt_id: parseInt(attemptId, 10)
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to submit examination.');
    }

    // Clear local cache
    try {
      localStorage.removeItem(`exam_answers_${attemptId}`);
    } catch (e) {}

    // Redirect to Result Page
    const finalAttemptId = data.attempt_id || attemptId;
    window.location.href = `result.html?attemptId=${finalAttemptId}`;

  } catch (err) {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Examination';
    }
    const alertBox = document.getElementById('submit-error-alert');
    if (alertBox) {
      alertBox.textContent = err.message;
      alertBox.style.display = 'block';
    } else {
      alert('Submission error: ' + err.message);
    }
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
  initExam();
});
