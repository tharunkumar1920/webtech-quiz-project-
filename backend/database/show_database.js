require('dotenv').config();
// Script to inspect and display all database tables and records in terminal
const { query, isPostgres } = require('./db');

async function showDatabase() {
  const dbName = isPostgres ? 'Supabase Cloud PostgreSQL' : 'Local SQLite (exam_portal.sqlite)';
  console.log('\n================================================================================');
  console.log(`              ✦ EDUQUEST DATABASE INSPECTOR (${dbName}) ✦              `);
  console.log('================================================================================\n');

  try {
    // 1. Admins & Instructors Table
    console.log('--- [1] Admins & Instructors Table (`Admins`) ---');
    const admins = await query('SELECT id, name, username, role, created_at FROM Admins');
    console.table(admins);

    // 2. Students Table
    console.log('\n--- [2] Registered Students Table (`Students`) ---');
    const students = await query('SELECT id, enrollment_no, name, email, department, course, semester FROM Students');
    console.table(students);

    // 3. Exams Table
    console.log('\n--- [3] Examinations / Quizzes Table (`Exams`) ---');
    const exams = await query('SELECT id, exam_code, title, subject, duration_minutes, total_questions, max_marks, is_active FROM Exams');
    console.table(exams);

    // 4. Questions Count per Exam
    console.log('\n--- [4] Questions Summary per Exam (`Questions`) ---');
    const questionsSummary = await query(`
      SELECT e.id AS exam_id, e.exam_code, e.title, COUNT(q.id) AS total_questions_in_db, COALESCE(SUM(q.marks), 0) AS total_marks
      FROM Exams e
      LEFT JOIN Questions q ON q.exam_id = e.id
      GROUP BY e.id, e.exam_code, e.title
    `);
    console.table(questionsSummary);

    // 5. Sample Questions
    console.log('\n--- [5] Sample Questions from Question Bank (`Questions`) ---');
    const sampleQuestions = await query('SELECT id, exam_id, question_text, topic, marks, correct_option FROM Questions LIMIT 5');
    console.table(sampleQuestions);

    // 6. Exam Attempts Table
    console.log('\n--- [6] Completed & In-Progress Exam Attempts (`Exam_Attempts`) ---');
    const attempts = await query(`
      SELECT a.id, s.name AS student_name, s.enrollment_no, e.exam_code, a.total_score, a.status, a.start_time, a.end_time
      FROM Exam_Attempts a
      JOIN Students s ON a.student_id = s.id
      JOIN Exams e ON a.exam_id = e.id
      ORDER BY a.id DESC LIMIT 10
    `);
    if (attempts.length === 0) {
      console.log('No attempts recorded yet.');
    } else {
      console.table(attempts);
    }

    console.log('\n================================================================================');
    console.log(`Database inspection complete. Active Database: ${dbName}`);
    console.log('================================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Error querying database:', err);
    process.exit(1);
  }
}

showDatabase();
