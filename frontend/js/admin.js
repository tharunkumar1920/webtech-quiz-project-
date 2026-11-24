// University Examination Portal - Administrator Console Logic

let currentAdmin = null;
let cachedStudents = [];
let cachedExams = [];
let currentEditingQuestion = null;

// Auth Verification
async function checkAdminAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = 'index.html';
      return null;
    }
    const data = await res.json();
    const user = data.user;
    const role = user?.role || data.role;
    if (role !== 'admin' || !user) {
      window.location.href = 'index.html';
      return null;
    }
    currentAdmin = user;
    document.getElementById('admin-display-name').textContent = currentAdmin.name || currentAdmin.username || 'Administrator';
    document.getElementById('admin-display-role').textContent = currentAdmin.role ? currentAdmin.role.toUpperCase() : 'SYSTEM ADMIN';
    return currentAdmin;
  } catch (err) {
    window.location.href = 'index.html';
    return null;
  }
}

async function logoutAdmin() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = 'index.html';
  }
}

function showToast(message, type = 'success') {
  const alertBox = document.getElementById('admin-alert');
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 4000);
}

// Tab Switching
function switchAdminTab(tabName) {
  const tabs = ['students', 'exams', 'questions', 'results', 'instructors'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const sec = document.getElementById(`tab-section-${t}`);
    if (t === tabName) {
      btn?.classList.add('active');
      sec?.classList.add('active');
    } else {
      btn?.classList.remove('active');
      sec?.classList.remove('active');
    }
  });

  if (tabName === 'students') loadStudents();
  else if (tabName === 'exams') loadExams();
  else if (tabName === 'questions') {
    populateExamDropdowns();
  } else if (tabName === 'results') loadAdminResults();
  else if (tabName === 'instructors') loadInstructors();
}

// ==========================================================================
// 1. Student Management
// ==========================================================================

async function loadStudents() {
  const tbody = document.getElementById('students-tbody');
  try {
    const res = await fetch('/api/admin/students');
    if (!res.ok) throw new Error('Failed to load student registry.');
    const resData = await res.json();
    cachedStudents = Array.isArray(resData) ? resData : (resData.students || []);

    if (!cachedStudents || cachedStudents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No students registered yet.</td></tr>';
      return;
    }

    tbody.innerHTML = cachedStudents.map(s => `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(s.enrollment_no)}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td>${escapeHtml(s.department || '-')}</td>
        <td>${escapeHtml(s.course || '-')}</td>
        <td>${s.semester ? 'Sem ' + s.semester : '-'}</td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="openEditStudentModal(${s.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--error-color); padding: 2rem;">${err.message}</td></tr>`;
  }
}

function openAddStudentModal() {
  document.getElementById('student-modal-title').textContent = 'Register New Student';
  document.getElementById('student-form-id').value = '';
  document.getElementById('student-form-enrollment').value = '';
  document.getElementById('student-form-name').value = '';
  document.getElementById('student-form-email').value = '';
  document.getElementById('student-form-dept').value = '';
  document.getElementById('student-form-course').value = '';
  document.getElementById('student-form-semester').value = '';
  document.getElementById('student-form-password').value = '';
  document.getElementById('student-form-password').required = true;
  document.getElementById('student-modal').classList.add('show');
}

function openEditStudentModal(id) {
  const s = cachedStudents.find(st => st.id === id);
  if (!s) return;

  document.getElementById('student-modal-title').textContent = 'Edit Student Record';
  document.getElementById('student-form-id').value = s.id;
  document.getElementById('student-form-enrollment').value = s.enrollment_no;
  document.getElementById('student-form-name').value = s.name;
  document.getElementById('student-form-email').value = s.email;
  document.getElementById('student-form-dept').value = s.department || '';
  document.getElementById('student-form-course').value = s.course || '';
  document.getElementById('student-form-semester').value = s.semester || '';
  document.getElementById('student-form-password').value = '';
  document.getElementById('student-form-password').required = false;
  document.getElementById('student-modal').classList.add('show');
}

function closeStudentModal() {
  document.getElementById('student-modal').classList.remove('show');
}

async function handleSaveStudent(e) {
  e.preventDefault();
  const id = document.getElementById('student-form-id').value;
  const enrollment_no = document.getElementById('student-form-enrollment').value.trim();
  const name = document.getElementById('student-form-name').value.trim();
  const email = document.getElementById('student-form-email').value.trim();
  const department = document.getElementById('student-form-dept').value.trim();
  const course = document.getElementById('student-form-course').value.trim();
  const semester = parseInt(document.getElementById('student-form-semester').value, 10);
  const password = document.getElementById('student-form-password').value;

  const payload = { enrollment_no, name, email, department, course, semester };
  if (password) payload.password = password;

  const btn = document.getElementById('save-student-btn');
  btn.disabled = true;

  try {
    let res;
    if (id) {
      res = await fetch(`/api/admin/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to save student.');

    closeStudentModal();
    showToast(id ? 'Student record updated successfully.' : 'Student registered successfully.');
    await loadStudents();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

// ==========================================================================
// 2. Exam Management
// ==========================================================================

async function loadExams() {
  const tbody = document.getElementById('exams-tbody');
  try {
    const res = await fetch('/api/admin/exams');
    if (!res.ok) throw new Error('Failed to load examinations.');
    const resData = await res.json();
    cachedExams = Array.isArray(resData) ? resData : (resData.exams || []);

    if (!cachedExams || cachedExams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No examinations found.</td></tr>';
      return;
    }

    tbody.innerHTML = cachedExams.map(ex => `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(ex.title)}</td>
        <td>${escapeHtml(ex.subject)}</td>
        <td><code style="background: #F0F0EE; padding: 2px 6px; border-radius: 3px; font-weight: 600;">${escapeHtml(ex.exam_code)}</code></td>
        <td>${ex.duration_minutes}m</td>
        <td>${ex.total_questions}</td>
        <td>${ex.max_marks}</td>
        <td>
          <span class="badge ${ex.is_active ? 'badge-success' : 'badge-neutral'}">
            ${ex.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-primary btn-sm" onclick="manageExamQuestions(${ex.id})">
            + Add Questions
          </button>
          <button class="btn btn-secondary btn-sm" style="margin-left: 0.25rem;" onclick="toggleExamActive(${ex.id})">
            ${ex.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="btn btn-secondary btn-sm" style="margin-left: 0.25rem;" onclick="openAssignModal(${ex.id}, '${escapeHtml(ex.title)}')">
            Assign
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--error-color); padding: 2rem;">${err.message}</td></tr>`;
  }
}

function manageExamQuestions(examId) {
  switchAdminTab('questions');
  setTimeout(() => {
    const filter = document.getElementById('questions-exam-filter');
    if (filter) {
      filter.value = examId;
      loadQuestionsForSelectedExam();
    }
  }, 100);
}

function openCreateExamModal() {
  document.getElementById('exam-form-title').value = '';
  document.getElementById('exam-form-subject').value = '';
  document.getElementById('exam-form-code').value = '';
  document.getElementById('exam-form-duration').value = '60';
  document.getElementById('exam-form-questions').value = '10';
  document.getElementById('exam-form-marks').value = '10';
  document.getElementById('exam-modal').classList.add('show');
}

function closeExamModal() {
  document.getElementById('exam-modal').classList.remove('show');
}

async function handleCreateExam(e) {
  e.preventDefault();
  const title = document.getElementById('exam-form-title').value.trim();
  const subject = document.getElementById('exam-form-subject').value.trim();
  const exam_code = document.getElementById('exam-form-code').value.trim();
  const duration_minutes = parseInt(document.getElementById('exam-form-duration').value, 10);
  const total_questions = parseInt(document.getElementById('exam-form-questions').value, 10);
  const max_marks = parseInt(document.getElementById('exam-form-marks').value, 10);

  const btn = document.getElementById('save-exam-btn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/admin/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject, exam_code, duration_minutes, total_questions, max_marks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to create exam.');

    closeExamModal();
    showToast('Examination created successfully! You can now add questions to this quiz below.');
    await loadExams();
    if (data.exam && data.exam.id) {
      manageExamQuestions(data.exam.id);
    }
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function toggleExamActive(id) {
  try {
    const res = await fetch(`/api/admin/exams/${id}/toggle`, { method: 'PUT' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to update status.');
    showToast('Examination status updated.');
    await loadExams();
  } catch (err) {
    alert(err.message);
  }
}

// Assignment Modal
async function openAssignModal(examId, title) {
  document.getElementById('assign-exam-id').value = examId;
  document.getElementById('assign-exam-title').textContent = title;
  const listContainer = document.getElementById('assign-students-list');
  listContainer.innerHTML = 'Loading students...';
  document.getElementById('assign-modal').classList.add('show');

  try {
    if (cachedStudents.length === 0) {
      const res = await fetch('/api/admin/students');
      const resData = await res.json();
      cachedStudents = Array.isArray(resData) ? resData : (resData.students || []);
    }

    if (!cachedStudents || cachedStudents.length === 0) {
      listContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-secondary);">No registered students found.</p>';
      return;
    }

    listContainer.innerHTML = cachedStudents.map(s => `
      <label style="display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0; font-size: 0.88rem; cursor: pointer; border-bottom: 1px solid #F0F0EE;">
        <input type="checkbox" name="assign_student_checkbox" value="${s.id}" checked>
        <span><strong>${escapeHtml(s.enrollment_no)}</strong> - ${escapeHtml(s.name)} (${escapeHtml(s.department || 'General')})</span>
      </label>
    `).join('');
  } catch (err) {
    listContainer.innerHTML = `<p style="color: var(--error-color); font-size: 0.85rem;">${err.message}</p>`;
  }
}

function selectAllAssignStudents(checked) {
  const boxes = document.querySelectorAll('input[name="assign_student_checkbox"]');
  boxes.forEach(b => b.checked = checked);
}

function closeAssignModal() {
  document.getElementById('assign-modal').classList.remove('show');
}

async function handleAssignExam(e) {
  e.preventDefault();
  const examId = document.getElementById('assign-exam-id').value;
  const checkedBoxes = Array.from(document.querySelectorAll('input[name="assign_student_checkbox"]:checked'));
  const studentIds = checkedBoxes.map(b => parseInt(b.value, 10));

  if (studentIds.length === 0) {
    alert('Please select at least one candidate to assign.');
    return;
  }

  const btn = document.getElementById('save-assign-btn');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/admin/exams/${examId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_ids: studentIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to assign examination.');

    closeAssignModal();
    showToast(`Examination successfully assigned to ${studentIds.length} candidate(s).`);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

// ==========================================================================
// 3. Question Bank Management
// ==========================================================================

async function populateExamDropdowns() {
  const filterSelect = document.getElementById('questions-exam-filter');
  const modalSelect = document.getElementById('question-form-exam-id');

  try {
    if (cachedExams.length === 0) {
      const res = await fetch('/api/admin/exams');
      const resData = await res.json();
      cachedExams = Array.isArray(resData) ? resData : (resData.exams || []);
    }

    const optionsHtml = cachedExams.map(ex => `<option value="${ex.id}">${escapeHtml(ex.title)} (${escapeHtml(ex.subject)})</option>`).join('');

    filterSelect.innerHTML = `<option value="">-- Choose Examination --</option>` + optionsHtml;
    modalSelect.innerHTML = optionsHtml;

    if (cachedExams.length > 0 && !filterSelect.value) {
      filterSelect.value = cachedExams[0].id;
      loadQuestionsForSelectedExam();
    }
  } catch (err) {
    console.error('Failed to populate exam dropdowns', err);
  }
}

async function loadQuestionsForSelectedExam() {
  const examId = document.getElementById('questions-exam-filter').value;
  const tbody = document.getElementById('questions-tbody');
  const quickCard = document.getElementById('quick-add-question-card');
  const quickExamName = document.getElementById('quick-add-exam-name');
  const quickExamId = document.getElementById('quick-question-exam-id');

  if (!examId) {
    if (quickCard) quickCard.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Please choose an examination above to view or add questions.</td></tr>';
    return;
  }

  // Display Quick Add Card with selected exam info
  if (quickCard) {
    quickCard.style.display = 'block';
    const selectedExam = cachedExams.find(e => String(e.id) === String(examId));
    if (quickExamName && selectedExam) {
      quickExamName.textContent = `${selectedExam.title} (${selectedExam.subject}) - Code: ${selectedExam.exam_code}`;
    }
    if (quickExamId) {
      quickExamId.value = examId;
    }
  }

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading questions...</td></tr>';

  try {
    const res = await fetch(`/api/admin/exams/${examId}/questions`);
    if (!res.ok) throw new Error('Failed to load questions.');
    const resData = await res.json();
    const questions = Array.isArray(resData) ? resData : (resData.questions || []);

    if (!questions || questions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No questions in this examination bank yet. Use the form above or click "+ Add Question" to add your first question!</td></tr>';
      return;
    }

    tbody.innerHTML = questions.map((q, idx) => `
      <tr>
        <td style="font-weight: 600;">${idx + 1}</td>
        <td>
          <div style="font-weight: 500; margin-bottom: 0.35rem;">${escapeHtml(q.question_text)}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem;">
            <div>A: ${escapeHtml(q.option_a)}</div>
            <div>B: ${escapeHtml(q.option_b)}</div>
            <div>C: ${escapeHtml(q.option_c)}</div>
            <div>D: ${escapeHtml(q.option_d)}</div>
          </div>
        </td>
        <td><span class="badge badge-neutral">${escapeHtml(q.topic || 'General')}</span></td>
        <td><strong>${q.marks || 1}</strong></td>
        <td><strong style="color: var(--success-color);">${(q.correct_option || '').toUpperCase()}</strong></td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick='openEditQuestionModal(${JSON.stringify(q).replace(/'/g, "&#39;")})'>Edit</button>
          <button class="btn btn-danger btn-sm" style="margin-left: 0.25rem;" onclick="deleteQuestion(${q.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--error-color); padding: 2rem;">${err.message}</td></tr>`;
  }
}

// Quick Add Question Form Handlers
async function handleQuickAddQuestion(e) {
  e.preventDefault();
  const exam_id = parseInt(document.getElementById('quick-question-exam-id').value, 10);
  const question_text = document.getElementById('quick-question-text').value.trim();
  const topic = document.getElementById('quick-question-topic').value.trim();
  const marks = parseFloat(document.getElementById('quick-question-marks').value) || 1.0;
  const option_a = document.getElementById('quick-question-opt-a').value.trim();
  const option_b = document.getElementById('quick-question-opt-b').value.trim();
  const option_c = document.getElementById('quick-question-opt-c').value.trim();
  const option_d = document.getElementById('quick-question-opt-d').value.trim();
  const correct_option = document.getElementById('quick-question-correct').value.toUpperCase();

  if (!exam_id) {
    alert('Please select an examination first.');
    return;
  }

  const payload = { exam_id, question_text, topic, marks, option_a, option_b, option_c, option_d, correct_option };
  const btn = document.getElementById('quick-question-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Adding Question...';

  try {
    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to add question.');

    showToast('Question successfully added to quiz!');
    resetQuickQuestionForm();
    await loadQuestionsForSelectedExam();

    // Invalidate cached exams so question count updates
    cachedExams = [];
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Add Question to Quiz';
  }
}

function resetQuickQuestionForm() {
  document.getElementById('quick-question-text').value = '';
  document.getElementById('quick-question-opt-a').value = '';
  document.getElementById('quick-question-opt-b').value = '';
  document.getElementById('quick-question-opt-c').value = '';
  document.getElementById('quick-question-opt-d').value = '';
  document.getElementById('quick-question-correct').value = 'A';
  const textEl = document.getElementById('quick-question-text');
  if (textEl) textEl.focus();
}

function openAddQuestionModal() {
  document.getElementById('question-modal-title').textContent = 'Add Multiple Choice Question';
  document.getElementById('question-form-id').value = '';
  document.getElementById('question-form-text').value = '';
  document.getElementById('question-form-topic').value = '';
  document.getElementById('question-form-marks').value = '1';
  document.getElementById('question-form-opt-a').value = '';
  document.getElementById('question-form-opt-b').value = '';
  document.getElementById('question-form-opt-c').value = '';
  document.getElementById('question-form-opt-d').value = '';
  document.getElementById('question-form-correct').value = 'A';

  const inlineBtn = document.getElementById('save-question-btn-inline');
  const footerBtn = document.getElementById('save-question-btn');
  const hintEl = document.getElementById('modal-inline-btn-hint');
  if (inlineBtn) inlineBtn.textContent = '+ Add Question';
  if (footerBtn) footerBtn.textContent = '+ Add Question';
  if (hintEl) hintEl.textContent = 'Finished entering question & options?';

  const filterExamId = document.getElementById('questions-exam-filter').value;
  if (filterExamId) {
    document.getElementById('question-form-exam-id').value = filterExamId;
  }

  document.getElementById('question-modal').classList.add('show');
}

function openEditQuestionModal(q) {
  document.getElementById('question-modal-title').textContent = 'Edit Multiple Choice Question';
  document.getElementById('question-form-id').value = q.id;
  document.getElementById('question-form-exam-id').value = q.exam_id;
  document.getElementById('question-form-text').value = q.question_text;
  document.getElementById('question-form-topic').value = q.topic || '';
  document.getElementById('question-form-marks').value = q.marks || 1;
  document.getElementById('question-form-opt-a').value = q.option_a;
  document.getElementById('question-form-opt-b').value = q.option_b;
  document.getElementById('question-form-opt-c').value = q.option_c;
  document.getElementById('question-form-opt-d').value = q.option_d;
  document.getElementById('question-form-correct').value = (q.correct_option || 'A').toUpperCase();

  const inlineBtn = document.getElementById('save-question-btn-inline');
  const footerBtn = document.getElementById('save-question-btn');
  const hintEl = document.getElementById('modal-inline-btn-hint');
  if (inlineBtn) inlineBtn.textContent = 'Save Changes';
  if (footerBtn) footerBtn.textContent = 'Save Changes';
  if (hintEl) hintEl.textContent = 'Update this question statement & options:';

  document.getElementById('question-modal').classList.add('show');
}

function closeQuestionModal() {
  document.getElementById('question-modal').classList.remove('show');
}

async function handleSaveQuestion(e) {
  e.preventDefault();
  const id = document.getElementById('question-form-id').value;
  const exam_id = parseInt(document.getElementById('question-form-exam-id').value, 10);
  const question_text = document.getElementById('question-form-text').value.trim();
  const topic = document.getElementById('question-form-topic').value.trim();
  const marks = parseFloat(document.getElementById('question-form-marks').value) || 1.0;
  const option_a = document.getElementById('question-form-opt-a').value.trim();
  const option_b = document.getElementById('question-form-opt-b').value.trim();
  const option_c = document.getElementById('question-form-opt-c').value.trim();
  const option_d = document.getElementById('question-form-opt-d').value.trim();
  const correct_option = document.getElementById('question-form-correct').value.toUpperCase();

  const payload = { exam_id, question_text, topic, marks, option_a, option_b, option_c, option_d, correct_option };
  const footerBtn = document.getElementById('save-question-btn');
  const inlineBtn = document.getElementById('save-question-btn-inline');
  if (footerBtn) footerBtn.disabled = true;
  if (inlineBtn) inlineBtn.disabled = true;

  try {
    let res;
    if (id) {
      res = await fetch(`/api/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to save question.');

    closeQuestionModal();
    showToast(id ? 'Question updated successfully.' : 'Question created successfully.');
    document.getElementById('questions-exam-filter').value = exam_id;
    cachedExams = [];
    await loadQuestionsForSelectedExam();
  } catch (err) {
    alert(err.message);
  } finally {
    if (footerBtn) footerBtn.disabled = false;
    if (inlineBtn) inlineBtn.disabled = false;
  }
}

async function deleteQuestion(id) {
  if (!confirm('Are you sure you want to permanently delete this question from the examination bank?')) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to delete question.');

    showToast('Question deleted successfully.');
    await loadQuestionsForSelectedExam();
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================================================
// 4. Results & Export
// ==========================================================================

async function loadAdminResults() {
  const tbody = document.getElementById('admin-results-tbody');
  try {
    const res = await fetch('/api/admin/results');
    if (!res.ok) throw new Error('Failed to load candidate results.');
    const resData = await res.json();
    const results = Array.isArray(resData) ? resData : (resData.results || []);

    if (!results || results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No candidate submissions recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = results.map(r => {
      const dateStr = r.completed_at ? new Date(r.completed_at).toLocaleDateString() + ' ' + new Date(r.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
      const pct = Number(r.percentage || 0).toFixed(1);
      const acc = Number(r.accuracy || 0).toFixed(1);

      return `
        <tr>
          <td style="font-weight: 600;">${escapeHtml(r.enrollment_no)}</td>
          <td>${escapeHtml(r.student_name || r.name || '-')}</td>
          <td>${escapeHtml(r.exam_title || r.title || '-')}</td>
          <td><strong>${r.total_marks_obtained || 0} / ${r.max_marks || 0}</strong></td>
          <td>${pct}%</td>
          <td>${acc}%</td>
          <td>${dateStr}</td>
          <td style="text-align: right;">
            <a href="result.html?attemptId=${r.attempt_id || r.id}" target="_blank" class="btn btn-secondary btn-sm">Report</a>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--error-color); padding: 2rem;">${err.message}</td></tr>`;
  }
}

// ==========================================================================
// 5. Simultaneous Quiz & Question Paper Studio
// ==========================================================================

let studioQuestionCounter = 0;

function openSimultaneousQuizStudio() {
  document.getElementById('studio-title').value = '';
  document.getElementById('studio-subject').value = 'Web Technologies';
  document.getElementById('studio-code').value = 'QUIZ' + Math.floor(100 + Math.random() * 900);
  document.getElementById('studio-duration').value = '25';
  document.getElementById('studio-auto-assign').checked = true;

  const container = document.getElementById('studio-questions-list');
  container.innerHTML = '';
  studioQuestionCounter = 0;

  // Add 1 clean initial question card
  addStudioQuestionCard();
  updateStudioSummary();

  document.getElementById('simultaneous-studio-modal').classList.add('show');
}

function closeSimultaneousStudio() {
  document.getElementById('simultaneous-studio-modal').classList.remove('show');
}

function addStudioQuestionCard(data = null) {
  studioQuestionCounter++;
  const cardId = `studio-q-${studioQuestionCounter}`;
  const container = document.getElementById('studio-questions-list');

  const defaultTopic = document.getElementById('studio-subject')?.value || 'Web Tech';

  const qText = data?.question_text || '';
  const qTopic = data?.topic || defaultTopic;
  const qMarks = data?.marks != null ? data.marks : 1;
  const optA = data?.option_a || '';
  const optB = data?.option_b || '';
  const optC = data?.option_c || '';
  const optD = data?.option_d || '';
  const correct = data?.correct_option || 'A';

  const cardHtml = `
    <div class="studio-question-card" id="${cardId}">
      <div class="studio-q-header">
        <span class="studio-q-badge">Question #${studioQuestionCounter}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="removeStudioQuestionCard('${cardId}')" style="color: var(--error-color); padding: 0.2rem 0.5rem; font-size: 0.8rem;">
          ✕ Remove
        </button>
      </div>

      <div class="form-group" style="margin-bottom: 0.75rem;">
        <label class="form-label" style="font-weight: 600;">Question Statement *</label>
        <textarea class="form-textarea studio-input-text" rows="2" placeholder="e.g. Which JavaScript method is used to parse a JSON string into an object?" required>${escapeHtml(qText)}</textarea>
      </div>

      <div class="form-row" style="margin-bottom: 0.75rem;">
        <div class="form-group" style="margin-bottom: 0; flex: 2;">
          <label class="form-label">Category / Topic Tag *</label>
          <input type="text" class="form-input studio-input-topic" placeholder="e.g. JavaScript" value="${escapeHtml(qTopic)}" required>
        </div>
        <div class="form-group" style="margin-bottom: 0; flex: 1;">
          <label class="form-label">Marks *</label>
          <input type="number" class="form-input studio-input-marks" min="1" max="100" value="${qMarks}" onchange="updateStudioSummary()" required>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <div class="studio-option-row">
            <span class="studio-opt-prefix">A</span>
            <input type="text" class="form-input studio-input-opta" placeholder="Option A text" value="${escapeHtml(optA)}" required>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <div class="studio-option-row">
            <span class="studio-opt-prefix">B</span>
            <input type="text" class="form-input studio-input-optb" placeholder="Option B text" value="${escapeHtml(optB)}" required>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <div class="studio-option-row">
            <span class="studio-opt-prefix">C</span>
            <input type="text" class="form-input studio-input-optc" placeholder="Option C text" value="${escapeHtml(optC)}" required>
          </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <div class="studio-option-row">
            <span class="studio-opt-prefix">D</span>
            <input type="text" class="form-input studio-input-optd" placeholder="Option D text" value="${escapeHtml(optD)}" required>
          </div>
        </div>
      </div>

      <div style="background: var(--bg-cream-tint); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Correct Answer Option:</span>
        <div class="correct-selector-group">
          <label class="correct-radio-label">
            <input type="radio" name="correct_${cardId}" value="A" ${correct === 'A' ? 'checked' : ''} required> Option A
          </label>
          <label class="correct-radio-label">
            <input type="radio" name="correct_${cardId}" value="B" ${correct === 'B' ? 'checked' : ''}> Option B
          </label>
          <label class="correct-radio-label">
            <input type="radio" name="correct_${cardId}" value="C" ${correct === 'C' ? 'checked' : ''}> Option C
          </label>
          <label class="correct-radio-label">
            <input type="radio" name="correct_${cardId}" value="D" ${correct === 'D' ? 'checked' : ''}> Option D
          </label>
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', cardHtml);
  updateStudioSummary();
}

function removeStudioQuestionCard(cardId) {
  const card = document.getElementById(cardId);
  const cards = document.querySelectorAll('.studio-question-card');
  if (cards.length <= 1) {
    alert('A quiz must contain at least one question.');
    return;
  }
  if (card) {
    card.remove();
    updateStudioSummary();
  }
}

function updateStudioSummary() {
  const cards = document.querySelectorAll('.studio-question-card');
  let totalMarks = 0;
  cards.forEach(c => {
    const markInput = c.querySelector('.studio-input-marks');
    totalMarks += (markInput && Number(markInput.value) > 0) ? Number(markInput.value) : 1;
  });

  const countBadge = document.getElementById('studio-count-badge');
  const marksBadge = document.getElementById('studio-marks-badge');
  if (countBadge) countBadge.textContent = `${cards.length} Question${cards.length === 1 ? '' : 's'}`;
  if (marksBadge) marksBadge.textContent = `${totalMarks} Mark${totalMarks === 1 ? '' : 's'} Total`;
}

function loadStudioPresetQuestions() {
  const container = document.getElementById('studio-questions-list');
  container.innerHTML = '';
  studioQuestionCounter = 0;

  const presets = [
    {
      question_text: 'What will be the output of `console.log(typeof NaN)` in modern JavaScript?',
      topic: 'JavaScript Basics',
      marks: 2,
      option_a: 'number',
      option_b: 'NaN',
      option_c: 'undefined',
      option_d: 'object',
      correct_option: 'A'
    },
    {
      question_text: 'Which HTTP status code signifies that a requested resource was successfully created on the server?',
      topic: 'Web API & REST',
      marks: 2,
      option_a: '200 OK',
      option_b: '201 Created',
      option_c: '204 No Content',
      option_d: '304 Not Modified',
      correct_option: 'B'
    },
    {
      question_text: 'In CSS Flexbox layout, which property controls alignment of child items along the cross axis?',
      topic: 'CSS Flexbox',
      marks: 2,
      option_a: 'justify-content',
      option_b: 'align-items',
      option_c: 'flex-direction',
      option_d: 'align-self',
      correct_option: 'B'
    }
  ];

  presets.forEach(p => addStudioQuestionCard(p));
  updateStudioSummary();
  showToast('Loaded 3 sample preset questions into the simultaneous studio!');
}

async function handleSimultaneousStudioSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('studio-title').value.trim();
  const subject = document.getElementById('studio-subject').value.trim();
  const exam_code = document.getElementById('studio-code').value.trim();
  const duration_minutes = parseInt(document.getElementById('studio-duration').value, 10);
  const auto_assign_all = document.getElementById('studio-auto-assign').checked;

  const cards = document.querySelectorAll('.studio-question-card');
  if (cards.length === 0) {
    alert('Please add at least one question to the question paper.');
    return;
  }

  const questions = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const text = card.querySelector('.studio-input-text')?.value.trim();
    const topic = card.querySelector('.studio-input-topic')?.value.trim();
    const marks = parseFloat(card.querySelector('.studio-input-marks')?.value) || 1;
    const optA = card.querySelector('.studio-input-opta')?.value.trim();
    const optB = card.querySelector('.studio-input-optb')?.value.trim();
    const optC = card.querySelector('.studio-input-optc')?.value.trim();
    const optD = card.querySelector('.studio-input-optd')?.value.trim();

    const checkedRadio = card.querySelector('input[type="radio"]:checked');
    const correct_option = checkedRadio ? checkedRadio.value : 'A';

    if (!text || !optA || !optB || !optC || !optD) {
      alert(`Question #${i + 1} has missing required text or options.`);
      return;
    }

    questions.push({
      question_text: text,
      topic: topic || subject,
      marks: marks,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      correct_option: correct_option
    });
  }

  const submitBtn = document.getElementById('studio-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publishing Quiz & Questions...';

  try {
    const res = await fetch('/api/admin/exams-with-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subject,
        exam_code,
        duration_minutes,
        auto_assign_all,
        questions
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to publish quiz and questions.');

    closeSimultaneousStudio();
    showToast(`🎉 Quiz '${title}' and ${questions.length} questions successfully created simultaneously!`);
    await loadExams();
    populateExamDropdowns();
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Publish Quiz & Question Paper Simultaneously';
  }
}

// ==========================================================================
// 5. Instructor & Staff Management
// ==========================================================================

async function loadInstructors() {
  const tbody = document.getElementById('instructors-tbody');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading instructors list...</td></tr>';
    const res = await fetch('/api/admin/instructors');
    if (!res.ok) throw new Error('Failed to load instructor accounts');
    const resData = await res.json();
    const instructors = Array.isArray(resData) ? resData : (resData.instructors || []);

    if (!Array.isArray(instructors) || instructors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No instructors or administrators found.</td></tr>';
      return;
    }

    tbody.innerHTML = instructors.map(inst => {
      const isSelf = currentAdmin && (currentAdmin.id === inst.id || currentAdmin.username === inst.username);
      const isSuper = inst.role === 'admin';
      return `
        <tr>
          <td style="font-weight: 600;">#${inst.id}</td>
          <td style="font-weight: 600;">${escapeHtml(inst.name)}</td>
          <td><code style="font-family: monospace; background: var(--bg-cream); padding: 0.2rem 0.4rem; border-radius: 4px;">${escapeHtml(inst.username)}</code></td>
          <td>
            <span class="badge ${isSuper ? 'badge-primary' : 'badge-neutral'}" style="font-size: 0.78rem;">
              ${isSuper ? '🛡️ Administrator' : '🎓 Instructor'}
            </span>
          </td>
          <td style="font-size: 0.85rem; color: var(--text-secondary);">
            ${inst.created_at ? new Date(inst.created_at).toLocaleDateString() : 'Active'}
          </td>
          <td style="text-align: right;">
            ${isSelf
              ? '<span class="badge badge-neutral" style="font-size: 0.75rem;">(Current User)</span>'
              : `<button class="btn btn-secondary btn-sm" style="color: #DC2626; border-color: #FCA5A5;" onclick="deleteInstructor(${inst.id}, '${escapeHtml(inst.username)}')">Remove</button>`
            }
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('loadInstructors error:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--accent-red); padding: 2rem;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function openAddInstructorModal() {
  const modal = document.getElementById('instructor-modal');
  if (modal) {
    document.getElementById('add-instructor-form')?.reset();
    modal.classList.add('show');
    modal.classList.add('active');
  }
}

function closeAddInstructorModal() {
  const modal = document.getElementById('instructor-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.classList.remove('active');
  }
}

async function handleSaveInstructor(event) {
  event.preventDefault();
  const name = document.getElementById('inst-form-name').value.trim();
  const username = document.getElementById('inst-form-username').value.trim();
  const role = document.getElementById('inst-form-role').value;
  const password = document.getElementById('inst-form-password').value;

  if (!name || !username || !password) {
    alert('Please fill out all required fields.');
    return;
  }

  const submitBtn = document.getElementById('inst-form-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/admin/instructors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, role, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create instructor account.');

    closeAddInstructorModal();
    showToast(`Staff member "${name}" (${username}) created successfully!`);
    await loadInstructors();
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Staff Account';
  }
}

async function deleteInstructor(id, username) {
  if (!confirm(`Are you sure you want to remove instructor / admin "${username}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/instructors/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to remove instructor.');

    showToast(`Staff member "${username}" has been removed.`);
    await loadInstructors();
  } catch (err) {
    alert(err.message);
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
  const admin = await checkAdminAuth();
  if (admin) {
    await loadStudents();
  }
});
