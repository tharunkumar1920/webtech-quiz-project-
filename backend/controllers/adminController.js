let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const { get, query, run } = require('../database/db');

// Helper to update exam total questions & max marks
async function syncExamTotals(examId) {
  const totals = await get(
    `SELECT COUNT(*) AS total_q, COALESCE(SUM(marks), 0) AS total_m FROM Questions WHERE exam_id = ?`,
    [examId]
  );
  await run(
    `UPDATE Exams SET total_questions = ?, max_marks = ? WHERE id = ?`,
    [totals.total_q || 0, totals.total_m || 0, examId]
  );
}

// -------------------------------------------------------------
// STUDENT MANAGEMENT
// -------------------------------------------------------------

/**
 * Get all registered students
 * GET /api/admin/students
 */
async function getAllStudents(req, res) {
  try {
    const students = await query(`
      SELECT
        s.id,
        s.enrollment_no,
        s.name,
        s.email,
        s.department,
        s.course,
        s.semester,
        s.created_at,
        (SELECT COUNT(*) FROM Exam_Assignments ea WHERE ea.student_id = s.id) AS assigned_exams_count,
        (SELECT COUNT(*) FROM Exam_Attempts att WHERE att.student_id = s.id AND att.status = 'completed') AS completed_attempts_count
      FROM Students s
      ORDER BY s.enrollment_no ASC
    `);

    return res.json({
      success: true,
      students
    });
  } catch (error) {
    console.error('Error in getAllStudents:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
}

/**
 * Create a new student
 * POST /api/admin/students
 * Body: { enrollment_no, name, email, password, department, course, semester }
 */
async function createStudent(req, res) {
  try {
    const { enrollment_no, name, email, password, department, course, semester } = req.body;

    if (!enrollment_no || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Enrollment number, name, email, and password are required'
      });
    }

    const cleanEnrollment = enrollment_no.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate enrollment or email
    const existing = await get(
      `SELECT id, enrollment_no, email FROM Students WHERE UPPER(enrollment_no) = UPPER(?) OR LOWER(email) = LOWER(?)`,
      [cleanEnrollment, cleanEmail]
    );

    if (existing) {
      if (existing.enrollment_no.toUpperCase() === cleanEnrollment.toUpperCase()) {
        return res.status(400).json({ success: false, error: 'A student with this enrollment number already exists' });
      }
      return res.status(400).json({ success: false, error: 'A student with this email address already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertRes = await run(
      `INSERT INTO Students (enrollment_no, name, email, password_hash, department, course, semester)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanEnrollment,
        name.trim(),
        cleanEmail,
        passwordHash,
        (department || 'Computer Science & Engineering').trim(),
        (course || 'B.Tech').trim(),
        parseInt(semester, 10) || 1
      ]
    );

    const newStudent = await get(
      `SELECT id, enrollment_no, name, email, department, course, semester, created_at FROM Students WHERE id = ?`,
      [insertRes.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      student: newStudent
    });
  } catch (error) {
    console.error('Error in createStudent:', error);
    return res.status(500).json({ success: false, error: 'Failed to create student' });
  }
}

/**
 * Update an existing student
 * PUT /api/admin/students/:id
 */
async function updateStudent(req, res) {
  try {
    const { id } = req.params;
    const { name, email, department, course, semester, password } = req.body;

    const student = await get(`SELECT * FROM Students WHERE id = ?`, [id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    let passwordHash = student.password_hash;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const cleanEmail = email ? email.trim().toLowerCase() : student.email;

    // Check email uniqueness if changed
    if (cleanEmail !== student.email) {
      const emailConflict = await get(
        `SELECT id FROM Students WHERE LOWER(email) = LOWER(?) AND id != ?`,
        [cleanEmail, id]
      );
      if (emailConflict) {
        return res.status(400).json({ success: false, error: 'Email is already used by another student' });
      }
    }

    await run(
      `UPDATE Students SET
        name = ?,
        email = ?,
        department = ?,
        course = ?,
        semester = ?,
        password_hash = ?
       WHERE id = ?`,
      [
        name ? name.trim() : student.name,
        cleanEmail,
        department ? department.trim() : student.department,
        course ? course.trim() : student.course,
        semester != null ? parseInt(semester, 10) : student.semester,
        passwordHash,
        id
      ]
    );

    const updated = await get(
      `SELECT id, enrollment_no, name, email, department, course, semester, created_at FROM Students WHERE id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Student details updated successfully',
      student: updated
    });
  } catch (error) {
    console.error('Error in updateStudent:', error);
    return res.status(500).json({ success: false, error: 'Failed to update student' });
  }
}

// -------------------------------------------------------------
// EXAM MANAGEMENT & ASSIGNMENTS
// -------------------------------------------------------------

/**
 * Get all exams with metadata
 * GET /api/admin/exams
 */
async function getAllExams(req, res) {
  try {
    const exams = await query(`
      SELECT
        e.id,
        e.title,
        e.subject,
        e.exam_code,
        e.duration_minutes,
        e.total_questions,
        e.max_marks,
        e.is_active,
        e.created_at,
        (SELECT COUNT(*) FROM Questions q WHERE q.exam_id = e.id) AS question_count,
        (SELECT COUNT(*) FROM Exam_Assignments ea WHERE ea.exam_id = e.id) AS assigned_student_count,
        (SELECT COUNT(*) FROM Exam_Attempts att WHERE att.exam_id = e.id AND att.status = 'completed') AS completed_attempt_count
      FROM Exams e
      ORDER BY e.created_at DESC
    `);

    return res.json({
      success: true,
      exams
    });
  } catch (error) {
    console.error('Error in getAllExams:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch examinations' });
  }
}

/**
 * Create a new examination
 * POST /api/admin/exams
 */
async function createExam(req, res) {
  try {
    const { title, subject, exam_code, duration_minutes, is_active } = req.body;

    if (!title || !subject || !exam_code || !duration_minutes) {
      return res.status(400).json({
        success: false,
        error: 'Title, Subject, Exam Code, and Duration (minutes) are required'
      });
    }

    const cleanCode = exam_code.trim().toUpperCase();

    const existing = await get(
      `SELECT id FROM Exams WHERE UPPER(exam_code) = ?`,
      [cleanCode]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'An examination with this Exam Code already exists'
      });
    }

    const insertRes = await run(
      `INSERT INTO Exams (title, subject, exam_code, duration_minutes, total_questions, max_marks, is_active)
       VALUES (?, ?, ?, ?, 0, 0, ?)`,
      [
        title.trim(),
        subject.trim(),
        cleanCode,
        parseInt(duration_minutes, 10),
        is_active === 0 || is_active === false ? 0 : 1
      ]
    );

    const newExam = await get(`SELECT * FROM Exams WHERE id = ?`, [insertRes.id]);

    return res.status(201).json({
      success: true,
      message: 'Examination created successfully',
      exam: newExam
    });
  } catch (error) {
    console.error('Error in createExam:', error);
    return res.status(500).json({ success: false, error: 'Failed to create examination' });
  }
}

/**
 * Create an Examination and its Question Paper simultaneously in one unified workflow
 * POST /api/admin/exams-with-questions
 */
async function createExamWithQuestions(req, res) {
  try {
    const { title, subject, exam_code, duration_minutes, is_active, auto_assign_all, questions } = req.body;

    if (!title || !subject || !exam_code || !duration_minutes) {
      return res.status(400).json({
        success: false,
        error: 'Title, Subject, Access Passcode (Exam Code), and Duration (minutes) are required'
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one question is required to create an exam with its question paper simultaneously.'
      });
    }

    // Validate all questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
        return res.status(400).json({
          success: false,
          error: `Question #${i + 1} is incomplete. Question text, options A-D, and correct option are required.`
        });
      }
      const upperCorrect = String(q.correct_option).trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(upperCorrect)) {
        return res.status(400).json({
          success: false,
          error: `Question #${i + 1} has invalid correct option '${q.correct_option}'. Must be A, B, C, or D.`
        });
      }
    }

    const cleanCode = exam_code.trim().toUpperCase();
    const existing = await get(
      `SELECT id FROM Exams WHERE UPPER(exam_code) = ?`,
      [cleanCode]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `An examination with code '${cleanCode}' already exists. Please choose a unique passcode.`
      });
    }

    // Calculate total marks
    let totalMarks = 0;
    questions.forEach(q => {
      totalMarks += (q.marks != null && Number(q.marks) > 0) ? Number(q.marks) : 1;
    });

    const activeFlag = (is_active === 0 || is_active === false) ? 0 : 1;

    // 1. Insert Exam
    const examRes = await run(
      `INSERT INTO Exams (title, subject, exam_code, duration_minutes, total_questions, max_marks, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        subject.trim(),
        cleanCode,
        parseInt(duration_minutes, 10),
        questions.length,
        totalMarks,
        activeFlag
      ]
    );

    const examId = examRes.id;

    // 2. Insert All Questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qMarks = (q.marks != null && Number(q.marks) > 0) ? Number(q.marks) : 1;
      const qTopic = (q.topic || subject || 'General').trim();
      const qCorrect = String(q.correct_option).trim().toUpperCase();

      await run(
        `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          examId,
          q.question_text.trim(),
          q.option_a.trim(),
          q.option_b.trim(),
          q.option_c.trim(),
          q.option_d.trim(),
          qCorrect,
          qMarks,
          qTopic
        ]
      );
    }

    // 3. Auto-assign to all enrolled students by default
    let assignedCount = 0;
    if (auto_assign_all !== false) {
      const allStudents = await query(`SELECT id FROM Students`);
      for (const stu of allStudents) {
        await run(
          `INSERT INTO Exam_Assignments (exam_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
          [examId, stu.id]
        );
        assignedCount++;
      }
    }

    const createdExam = await get(`SELECT * FROM Exams WHERE id = ?`, [examId]);

    return res.status(201).json({
      success: true,
      message: `Exam '${title}' and ${questions.length} question(s) successfully created and assigned to ${assignedCount} learner(s)!`,
      exam: createdExam,
      questions_count: questions.length,
      assigned_students_count: assignedCount
    });

  } catch (error) {
    console.error('Error in createExamWithQuestions:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while creating the examination and questions.'
    });
  }
}

/**
 * Update an existing examination
 * PUT /api/admin/exams/:id
 */
async function updateExam(req, res) {
  try {
    const { id } = req.params;
    const { title, subject, exam_code, duration_minutes, is_active } = req.body;

    const exam = await get(`SELECT * FROM Exams WHERE id = ?`, [id]);
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Examination not found' });
    }

    let cleanCode = exam.exam_code;
    if (exam_code) {
      cleanCode = exam_code.trim().toUpperCase();
      if (cleanCode !== exam.exam_code) {
        const codeConflict = await get(
          `SELECT id FROM Exams WHERE UPPER(exam_code) = ? AND id != ?`,
          [cleanCode, id]
        );
        if (codeConflict) {
          return res.status(400).json({
            success: false,
            error: 'Exam code is already in use by another examination'
          });
        }
      }
    }

    await run(
      `UPDATE Exams SET
        title = ?,
        subject = ?,
        exam_code = ?,
        duration_minutes = ?,
        is_active = ?
       WHERE id = ?`,
      [
        title ? title.trim() : exam.title,
        subject ? subject.trim() : exam.subject,
        cleanCode,
        duration_minutes ? parseInt(duration_minutes, 10) : exam.duration_minutes,
        is_active != null ? (is_active ? 1 : 0) : exam.is_active,
        id
      ]
    );

    await syncExamTotals(id);
    const updated = await get(`SELECT * FROM Exams WHERE id = ?`, [id]);

    return res.json({
      success: true,
      message: 'Examination updated successfully',
      exam: updated
    });
  } catch (error) {
    console.error('Error in updateExam:', error);
    return res.status(500).json({ success: false, error: 'Failed to update examination' });
  }
}

/**
 * Toggle examination active status
 * PUT /api/admin/exams/:id/toggle
 */
async function toggleExamStatus(req, res) {
  try {
    const { id } = req.params;
    const exam = await get(`SELECT * FROM Exams WHERE id = ?`, [id]);
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Examination not found' });
    }

    const newStatus = exam.is_active === 1 ? 0 : 1;
    await run(`UPDATE Exams SET is_active = ? WHERE id = ?`, [newStatus, id]);
    const updatedExam = await get(`SELECT * FROM Exams WHERE id = ?`, [id]);

    return res.json({
      success: true,
      message: `Examination ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
      is_active: newStatus,
      exam: updatedExam
    });
  } catch (error) {
    console.error('Error in toggleExamStatus:', error);
    return res.status(500).json({ success: false, error: 'Failed to toggle exam status' });
  }
}

/**
 * Assign examination to students
 * POST /api/admin/exams/:id/assign
 * Body: { student_ids: [1, 2, ...], assign_all: boolean }
 */
async function assignExamToStudents(req, res) {
  try {
    const { id } = req.params;
    const { student_ids, assign_all } = req.body;

    const exam = await get(`SELECT id, title FROM Exams WHERE id = ?`, [id]);
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Examination not found' });
    }

    let targetStudentIds = [];

    if (assign_all) {
      const allStudents = await query(`SELECT id FROM Students`);
      targetStudentIds = allStudents.map((s) => s.id);
    } else if (Array.isArray(student_ids)) {
      targetStudentIds = student_ids;
    } else if (req.body.student_id) {
      targetStudentIds = [req.body.student_id];
    }

    if (targetStudentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No students specified for assignment'
      });
    }

    let assignedCount = 0;
    for (const sId of targetStudentIds) {
      const result = await run(
        `INSERT INTO Exam_Assignments (exam_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
        [id, sId]
      );
      if (result.changes > 0) {
        assignedCount += 1;
      }
    }

    return res.json({
      success: true,
      message: `Exam assigned to ${assignedCount} new student(s)`,
      total_targeted: targetStudentIds.length,
      assigned_count: assignedCount
    });
  } catch (error) {
    console.error('Error in assignExamToStudents:', error);
    return res.status(500).json({ success: false, error: 'Failed to assign examination' });
  }
}

/**
 * Get assigned students for an exam
 * GET /api/admin/exams/:id/assignments
 */
async function getExamAssignments(req, res) {
  try {
    const { id } = req.params;
    const assignments = await query(
      `SELECT
        ea.id AS assignment_id,
        ea.assigned_at,
        s.id AS student_id,
        s.enrollment_no,
        s.name,
        s.email,
        s.department,
        att.status AS attempt_status,
        att.id AS attempt_id,
        res.percentage
       FROM Exam_Assignments ea
       JOIN Students s ON ea.student_id = s.id
       LEFT JOIN Exam_Attempts att ON att.exam_id = ea.exam_id AND att.student_id = s.id
       LEFT JOIN Results res ON res.attempt_id = att.id
       WHERE ea.exam_id = ?
       ORDER BY s.enrollment_no ASC`,
      [id]
    );

    return res.json({
      success: true,
      assignments
    });
  } catch (error) {
    console.error('Error in getExamAssignments:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch exam assignments' });
  }
}

// -------------------------------------------------------------
// QUESTION MANAGEMENT
// -------------------------------------------------------------

/**
 * Get all questions for a specific exam
 * GET /api/admin/exams/:examId/questions
 */
async function getQuestionsByExam(req, res) {
  try {
    const { examId } = req.params;
    const questions = await query(
      `SELECT * FROM Questions WHERE exam_id = ? ORDER BY id ASC`,
      [examId]
    );

    return res.json({
      success: true,
      questions
    });
  } catch (error) {
    console.error('Error in getQuestionsByExam:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch exam questions' });
  }
}

/**
 * Add a new question to an exam
 * POST /api/admin/questions
 * Body: { exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic }
 */
async function createQuestion(req, res) {
  try {
    const {
      exam_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      marks,
      topic
    } = req.body;

    if (!exam_id || !question_text || !option_a || !option_b || !option_c || !option_d || !correct_option) {
      return res.status(400).json({
        success: false,
        error: 'Exam ID, question text, 4 options, and correct option are required'
      });
    }

    const cleanOption = correct_option.trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(cleanOption)) {
      return res.status(400).json({
        success: false,
        error: 'Correct option must be A, B, C, or D'
      });
    }

    const exam = await get(`SELECT id FROM Exams WHERE id = ?`, [exam_id]);
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Examination not found' });
    }

    const questionMarks = marks != null ? parseFloat(marks) : 1.0;
    const questionTopic = (topic && topic.trim()) ? topic.trim() : 'General';

    const insertRes = await run(
      `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exam_id,
        question_text.trim(),
        option_a.trim(),
        option_b.trim(),
        option_c.trim(),
        option_d.trim(),
        cleanOption,
        questionMarks,
        questionTopic
      ]
    );

    await syncExamTotals(exam_id);

    const newQuestion = await get(`SELECT * FROM Questions WHERE id = ?`, [insertRes.id]);

    return res.status(201).json({
      success: true,
      message: 'Question added successfully',
      question: newQuestion
    });
  } catch (error) {
    console.error('Error in createQuestion:', error);
    return res.status(500).json({ success: false, error: 'Failed to add question' });
  }
}

/**
 * Update an existing question
 * PUT /api/admin/questions/:id
 */
async function updateQuestion(req, res) {
  try {
    const { id } = req.params;
    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      marks,
      topic
    } = req.body;

    const question = await get(`SELECT * FROM Questions WHERE id = ?`, [id]);
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    let cleanOption = question.correct_option;
    if (correct_option) {
      cleanOption = correct_option.trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(cleanOption)) {
        return res.status(400).json({
          success: false,
          error: 'Correct option must be A, B, C, or D'
        });
      }
    }

    await run(
      `UPDATE Questions SET
        question_text = ?,
        option_a = ?,
        option_b = ?,
        option_c = ?,
        option_d = ?,
        correct_option = ?,
        marks = ?,
        topic = ?
       WHERE id = ?`,
      [
        question_text ? question_text.trim() : question.question_text,
        option_a ? option_a.trim() : question.option_a,
        option_b ? option_b.trim() : question.option_b,
        option_c ? option_c.trim() : question.option_c,
        option_d ? option_d.trim() : question.option_d,
        cleanOption,
        marks != null ? parseFloat(marks) : question.marks,
        topic ? topic.trim() : question.topic,
        id
      ]
    );

    await syncExamTotals(question.exam_id);

    const updated = await get(`SELECT * FROM Questions WHERE id = ?`, [id]);

    return res.json({
      success: true,
      message: 'Question updated successfully',
      question: updated
    });
  } catch (error) {
    console.error('Error in updateQuestion:', error);
    return res.status(500).json({ success: false, error: 'Failed to update question' });
  }
}

/**
 * Delete a question
 * DELETE /api/admin/questions/:id
 */
async function deleteQuestion(req, res) {
  try {
    const { id } = req.params;
    const question = await get(`SELECT * FROM Questions WHERE id = ?`, [id]);
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    const examId = question.exam_id;
    await run(`DELETE FROM Questions WHERE id = ?`, [id]);
    await syncExamTotals(examId);

    return res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteQuestion:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete question' });
  }
}

// -------------------------------------------------------------
// RESULTS MANAGEMENT & CSV EXPORT
// -------------------------------------------------------------

/**
 * Get all examination results with filtering
 * GET /api/admin/results?exam_id=&student_id=
 */
async function getAllResults(req, res) {
  try {
    const { exam_id, student_id } = req.query;

    let sql = `
      SELECT
        r.id AS result_id,
        r.attempt_id,
        r.total_questions,
        r.attempted_questions,
        r.correct_answers,
        r.incorrect_answers,
        r.unanswered_questions,
        r.total_marks_obtained,
        r.max_marks,
        r.percentage,
        r.accuracy,
        r.completed_at,
        s.id AS student_id,
        s.enrollment_no,
        s.name AS student_name,
        s.email AS student_email,
        s.department,
        s.course,
        s.semester,
        e.id AS exam_id,
        e.title AS exam_title,
        e.subject AS exam_subject,
        e.exam_code
      FROM Results r
      JOIN Students s ON r.student_id = s.id
      JOIN Exams e ON r.exam_id = e.id
      WHERE 1=1
    `;

    const params = [];
    if (exam_id) {
      sql += ` AND r.exam_id = ?`;
      params.push(exam_id);
    }
    if (student_id) {
      sql += ` AND r.student_id = ?`;
      params.push(student_id);
    }

    sql += ` ORDER BY r.completed_at DESC`;

    const results = await query(sql, params);

    return res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error in getAllResults:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch results' });
  }
}

/**
 * Export results to CSV
 * GET /api/admin/results/export?exam_id=
 */
async function exportResultsCSV(req, res) {
  try {
    const { exam_id } = req.query;

    let sql = `
      SELECT
        r.id AS result_id,
        r.attempt_id,
        s.enrollment_no,
        s.name AS student_name,
        s.email,
        s.department,
        s.course,
        s.semester,
        e.exam_code,
        e.title AS exam_title,
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
      JOIN Students s ON r.student_id = s.id
      JOIN Exams e ON r.exam_id = e.id
      WHERE 1=1
    `;

    const params = [];
    if (exam_id) {
      sql += ` AND r.exam_id = ?`;
      params.push(exam_id);
    }

    sql += ` ORDER BY r.completed_at DESC`;

    const rows = await query(sql, params);

    // Build CSV
    const headers = [
      'Result ID',
      'Attempt ID',
      'Enrollment Number',
      'Student Name',
      'Email',
      'Department',
      'Course',
      'Semester',
      'Exam Code',
      'Exam Title',
      'Total Questions',
      'Attempted Questions',
      'Correct Answers',
      'Incorrect Answers',
      'Unanswered Questions',
      'Marks Obtained',
      'Max Marks',
      'Percentage (%)',
      'Accuracy (%)',
      'Completed At'
    ];

    function escapeCSV(val) {
      if (val == null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }

    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        escapeCSV(r.result_id),
        escapeCSV(r.attempt_id),
        escapeCSV(r.enrollment_no),
        escapeCSV(r.student_name),
        escapeCSV(r.email),
        escapeCSV(r.department),
        escapeCSV(r.course),
        escapeCSV(r.semester),
        escapeCSV(r.exam_code),
        escapeCSV(r.exam_title),
        escapeCSV(r.total_questions),
        escapeCSV(r.attempted_questions),
        escapeCSV(r.correct_answers),
        escapeCSV(r.incorrect_answers),
        escapeCSV(r.unanswered_questions),
        escapeCSV(r.total_marks_obtained),
        escapeCSV(r.max_marks),
        escapeCSV(r.percentage),
        escapeCSV(r.accuracy),
        escapeCSV(r.completed_at)
      ];
      csvLines.push(line.join(','));
    }

    const csvContent = csvLines.join('\r\n');
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `exam_results_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error in exportResultsCSV:', error);
    return res.status(500).json({ success: false, error: 'Failed to export results CSV' });
  }
}

module.exports = {
  getAllStudents,
  createStudent,
  updateStudent,
  getAllExams,
  createExam,
  createExamWithQuestions,
  updateExam,
  toggleExamStatus,
  assignExamToStudents,
  getExamAssignments,
  getQuestionsByExam,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getAllResults,
  exportResultsCSV
};
