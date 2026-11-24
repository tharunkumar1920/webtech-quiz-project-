let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const { get, run, query } = require('../database/db');

/**
 * Student Registration (Sign Up)
 * POST /api/auth/student/register
 * Body: { name, email, enrollment_no, password, department, course, semester }
 */
async function studentRegister(req, res) {
  try {
    const { name, email, enrollment_no, password, department, course, semester } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email address, and password are required'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Generate enrollment number if not provided
    let cleanEnrollment = (enrollment_no || '').trim().toUpperCase();
    if (!cleanEnrollment) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      cleanEnrollment = `LRN${new Date().getFullYear()}${randomSuffix}`;
    }

    // Check duplicate email or enrollment
    const existing = await get(
      `SELECT id, enrollment_no, email FROM Students WHERE UPPER(enrollment_no) = UPPER(?) OR LOWER(email) = LOWER(?)`,
      [cleanEnrollment, cleanEmail]
    );

    if (existing) {
      if (existing.email.toLowerCase() === cleanEmail) {
        return res.status(400).json({
          success: false,
          error: 'An account with this email address already exists. Please sign in instead.'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'A learner with this ID or enrollment number already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const dept = (department || 'Computer Science & E-Learning').trim();
    const crs = (course || 'Interactive Tech').trim();
    const sem = semester ? parseInt(semester, 10) : 1;

    const insertResult = await run(
      `INSERT INTO Students (enrollment_no, name, email, password_hash, department, course, semester)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cleanEnrollment, cleanName, cleanEmail, passwordHash, dept, crs, sem]
    );

    const studentId = insertResult.id;

    // Automatically assign all active quizzes to the new student
    const activeExams = await query(`SELECT id FROM Exams WHERE is_active = 1`);
    for (const exam of activeExams) {
      await run(
        `INSERT INTO Exam_Assignments (exam_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
        [exam.id, studentId]
      );
    }

    // Log the student into session
    req.session.user = {
      id: studentId,
      enrollment_no: cleanEnrollment,
      name: cleanName,
      email: cleanEmail,
      department: dept,
      course: crs,
      semester: sem,
      role: 'student'
    };

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to the E-Learning Platform.',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error in studentRegister:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while creating your account.'
    });
  }
}

/**
 * Student Login (Accepts enrollment_no, email, or identifier)
 * POST /api/auth/student/login
 * Body: { enrollment_no, email, identifier, password }
 */
async function studentLogin(req, res) {
  try {
    const { enrollment_no, email, identifier, password } = req.body;
    const loginIdentifier = (identifier || enrollment_no || email || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email or Learner ID and password are required'
      });
    }

    const student = await get(
      `SELECT * FROM Students WHERE UPPER(enrollment_no) = UPPER(?) OR LOWER(email) = LOWER(?)`,
      [loginIdentifier, loginIdentifier]
    );

    if (!student) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email/Learner ID or password'
      });
    }

    const isMatch = await bcrypt.compare(password, student.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email/Learner ID or password'
      });
    }

    // Set session user
    req.session.user = {
      id: student.id,
      enrollment_no: student.enrollment_no,
      name: student.name,
      email: student.email,
      department: student.department,
      course: student.course,
      semester: student.semester,
      role: 'student'
    };

    return res.json({
      success: true,
      message: 'Welcome back! Login successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error in studentLogin:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during login'
    });
  }
}

/**
 * Admin Login
 * POST /api/auth/admin/login
 * Body: { username, password }
 */
async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const trimmedUsername = username.trim();
    const admin = await get(
      `SELECT * FROM Admins WHERE LOWER(username) = LOWER(?)`,
      [trimmedUsername]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator credentials'
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator credentials'
      });
    }

    // Set session user
    req.session.user = {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: 'admin'
    };

    return res.json({
      success: true,
      message: 'Administrator login successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error in adminLogin:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred during admin login'
    });
  }
}

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    if (req.session && req.session.user) {
      return res.json({
        success: true,
        authenticated: true,
        user: req.session.user
      });
    }

    return res.json({
      success: true,
      authenticated: false,
      user: null
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user status'
    });
  }
}

/**
 * Logout
 * POST /api/auth/logout
 */
function logout(req, res) {
  if (!req.session) {
    return res.json({ success: true, message: 'Logged out successfully' });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to log out'
      });
    }
    res.clearCookie('connect.sid');
    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}

module.exports = {
  studentRegister,
  studentLogin,
  adminLogin,
  getCurrentUser,
  logout
};
