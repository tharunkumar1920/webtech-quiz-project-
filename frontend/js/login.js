// EduQuest E-Learning Platform - Authentication Logic

let activeRole = 'student';
let activeLearnerMode = 'signin';
let activeAdminMode = 'signin';

function switchLoginTab(role) {
  activeRole = role;
  const studentTab = document.getElementById('tab-student');
  const adminTab = document.getElementById('tab-admin');
  const learnerSection = document.getElementById('learner-section');
  const adminSection = document.getElementById('admin-section');
  const alertBox = document.getElementById('login-alert');

  alertBox.style.display = 'none';

  if (role === 'student') {
    studentTab.classList.add('active');
    adminTab.classList.remove('active');
    learnerSection.style.display = 'block';
    if (adminSection) adminSection.style.display = 'none';
  } else {
    adminTab.classList.add('active');
    studentTab.classList.remove('active');
    learnerSection.style.display = 'none';
    if (adminSection) adminSection.style.display = 'block';
  }
}

function switchLearnerMode(mode) {
  activeLearnerMode = mode;
  const btnSignIn = document.getElementById('btn-mode-signin');
  const btnSignUp = document.getElementById('btn-mode-signup');
  const formSignIn = document.getElementById('student-login-form');
  const formSignUp = document.getElementById('student-signup-form');
  const alertBox = document.getElementById('login-alert');

  alertBox.style.display = 'none';

  if (mode === 'signin') {
    btnSignIn.style.background = '#FFFFFF';
    btnSignIn.style.color = 'var(--text-primary)';
    btnSignIn.style.fontWeight = '600';
    btnSignIn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';

    btnSignUp.style.background = 'transparent';
    btnSignUp.style.color = 'var(--text-secondary)';
    btnSignUp.style.fontWeight = '500';
    btnSignUp.style.boxShadow = 'none';

    formSignIn.style.display = 'block';
    formSignUp.style.display = 'none';
  } else {
    btnSignUp.style.background = '#FFFFFF';
    btnSignUp.style.color = 'var(--text-primary)';
    btnSignUp.style.fontWeight = '600';
    btnSignUp.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';

    btnSignIn.style.background = 'transparent';
    btnSignIn.style.color = 'var(--text-secondary)';
    btnSignIn.style.fontWeight = '500';
    btnSignIn.style.boxShadow = 'none';

    formSignIn.style.display = 'none';
    formSignUp.style.display = 'block';
  }
}

function switchAdminMode(mode) {
  activeAdminMode = mode;
  const btnSignIn = document.getElementById('btn-admin-mode-signin');
  const btnSignUp = document.getElementById('btn-admin-mode-signup');
  const formSignIn = document.getElementById('admin-login-form');
  const formSignUp = document.getElementById('admin-signup-form');
  const alertBox = document.getElementById('login-alert');

  if (alertBox) alertBox.style.display = 'none';

  if (mode === 'signin') {
    if (btnSignIn) {
      btnSignIn.style.background = '#FFFFFF';
      btnSignIn.style.color = 'var(--text-primary)';
      btnSignIn.style.fontWeight = '600';
      btnSignIn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    }
    if (btnSignUp) {
      btnSignUp.style.background = 'transparent';
      btnSignUp.style.color = 'var(--text-secondary)';
      btnSignUp.style.fontWeight = '500';
      btnSignUp.style.boxShadow = 'none';
    }
    if (formSignIn) formSignIn.style.display = 'block';
    if (formSignUp) formSignUp.style.display = 'none';
  } else {
    if (btnSignUp) {
      btnSignUp.style.background = '#FFFFFF';
      btnSignUp.style.color = 'var(--text-primary)';
      btnSignUp.style.fontWeight = '600';
      btnSignUp.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    }
    if (btnSignIn) {
      btnSignIn.style.background = 'transparent';
      btnSignIn.style.color = 'var(--text-secondary)';
      btnSignIn.style.fontWeight = '500';
      btnSignIn.style.boxShadow = 'none';
    }
    if (formSignIn) formSignIn.style.display = 'none';
    if (formSignUp) formSignUp.style.display = 'block';
  }
}

function showAlert(message, type = 'error') {
  const alertBox = document.getElementById('login-alert');
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.style.display = 'block';
}

async function handleStudentLogin(event) {
  event.preventDefault();
  const identifier = document.getElementById('student-identifier').value.trim();
  const password = document.getElementById('student-password').value;
  const submitBtn = document.getElementById('student-submit-btn');

  if (!identifier || !password) {
    showAlert('Please provide your email address or Learner ID and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in to EduQuest...';

  try {
    const res = await fetch('/api/auth/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Authentication failed.');
    }

    // Redirect to learner dashboard
    window.location.href = 'dashboard.html';
  } catch (err) {
    showAlert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In to Learning Studio';
  }
}

async function handleStudentSignup(event) {
  event.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const enrollment_no = document.getElementById('signup-enrollment').value.trim();
  const department = document.getElementById('signup-dept').value.trim();
  const course = document.getElementById('signup-course').value.trim();
  const password = document.getElementById('signup-password').value;
  const submitBtn = document.getElementById('signup-submit-btn');

  if (!name || !email || !password) {
    showAlert('Please enter your full name, email address, and a password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const res = await fetch('/api/auth/student/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        enrollment_no,
        department,
        course,
        semester: 1,
        password
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to create account.');
    }

    // Direct redirect to student dashboard
    window.location.href = 'dashboard.html';
  } catch (err) {
    showAlert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Learner Account';
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  const submitBtn = document.getElementById('admin-submit-btn');

  if (!username || !password) {
    showAlert('Please provide both administrative username and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    const res = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Authentication failed.');
    }

    // Redirect to admin dashboard
    window.location.href = 'admin.html';
  } catch (err) {
    showAlert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In as Instructor / Admin';
  }
}

async function handleAdminSignup(event) {
  event.preventDefault();
  const name = document.getElementById('admin-signup-name').value.trim();
  const username = document.getElementById('admin-signup-username').value.trim();
  const role = document.getElementById('admin-signup-role').value;
  const password = document.getElementById('admin-signup-password').value;
  const submitBtn = document.getElementById('admin-signup-submit-btn');

  if (!name || !username || !password) {
    showAlert('Please fill in your name, username, and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating Instructor Account...';

  try {
    const res = await fetch('/api/auth/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, role, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Registration failed.');
    }

    // Direct redirect to instructor/admin studio
    window.location.href = 'admin.html';
  } catch (err) {
    showAlert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Instructor Account';
  }
}

// Check session on load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      const user = data.user;
      const role = user?.role || data.role;
      if (user && role === 'student') {
        window.location.href = 'dashboard.html';
      } else if (user && role === 'admin') {
        window.location.href = 'admin.html';
      }
    }
  } catch (_) {
    // not logged in
  }
});
