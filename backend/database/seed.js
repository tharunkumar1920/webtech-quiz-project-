const path = require('path');
const fs = require('fs');

// Support both bcrypt and bcryptjs
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const { db, run, get, query, exec, initSchema } = require('./db');

async function seedDatabase() {
  console.log('--- Initializing Database Schema ---');
  await initSchema();
  console.log('Schema initialized successfully.');

  // 1. Seed Admins & Instructors
  console.log('--- Seeding Admins & Instructors ---');
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  const initialAdmins = [
    { username: 'admin', name: 'System Administrator', role: 'superadmin' },
    { username: 'instructor_tharun', name: 'Prof. Tharun Kumar', role: 'instructor' },
    { username: 'instructor_demo', name: 'Lead Quiz Instructor', role: 'instructor' }
  ];

  for (const adm of initialAdmins) {
    const existing = await get(`SELECT id FROM Admins WHERE LOWER(username) = LOWER(?)`, [adm.username]);
    if (!existing) {
      const res = await run(
        `INSERT INTO Admins (username, password_hash, name, role) VALUES (?, ?, ?, ?)`,
        [adm.username, adminPasswordHash, adm.name, adm.role]
      );
      console.log(`Created admin/instructor: ${adm.username} (ID: ${res.id})`);
    } else {
      await run(`UPDATE Admins SET password_hash = ?, name = ?, role = ? WHERE id = ?`, [adminPasswordHash, adm.name, adm.role, existing.id]);
      console.log(`Updated admin/instructor: ${adm.username} (ID: ${existing.id})`);
    }
  }

  // 2. Seed Students
  console.log('--- Seeding Students ---');
  const studentPasswordHash = bcrypt.hashSync('student123', 10);
  const studentsData = [
    {
      enrollment_no: 'STU2023001',
      name: 'Tharun Kumar',
      email: 'tharun.stu2023001@university.edu',
      department: 'Computer Science & Engineering',
      course: 'B.Tech Information Technology',
      semester: 5
    },
    {
      enrollment_no: 'STU2023002',
      name: 'Priya Sharma',
      email: 'priya.stu2023002@university.edu',
      department: 'Computer Science & Engineering',
      course: 'B.Tech Computer Science',
      semester: 5
    },
    {
      enrollment_no: 'STU2023003',
      name: 'Rahul Varma',
      email: 'rahul.stu2023003@university.edu',
      department: 'Information Science',
      course: 'B.Tech Information Science',
      semester: 5
    }
  ];

  const studentIds = {};
  for (const stu of studentsData) {
    const existing = await get(`SELECT id FROM Students WHERE enrollment_no = ?`, [stu.enrollment_no]);
    if (!existing) {
      const res = await run(
        `INSERT INTO Students (enrollment_no, name, email, password_hash, department, course, semester)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [stu.enrollment_no, stu.name, stu.email, studentPasswordHash, stu.department, stu.course, stu.semester]
      );
      studentIds[stu.enrollment_no] = res.id;
      console.log(`Created student: ${stu.enrollment_no} - ${stu.name} (ID: ${res.id})`);
    } else {
      studentIds[stu.enrollment_no] = existing.id;
      await run(`UPDATE Students SET password_hash = ? WHERE id = ?`, [studentPasswordHash, existing.id]);
      console.log(`Student already exists: ${stu.enrollment_no} (ID: ${existing.id})`);
    }
  }

  // 3. Seed Main Exam: Web Technologies & Database Systems
  console.log('--- Seeding Exams ---');
  const mainExamCode = 'WTDB2026';
  let examId;
  const existingExam = await get(`SELECT id FROM Exams WHERE exam_code = ?`, [mainExamCode]);
  if (!existingExam) {
    const res = await run(
      `INSERT INTO Exams (title, subject, exam_code, duration_minutes, total_questions, max_marks, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Web Technologies & Database Systems',
        'Computer Science',
        mainExamCode,
        30,
        12,
        12.0,
        1
      ]
    );
    examId = res.id;
    console.log(`Created exam: ${mainExamCode} (ID: ${examId})`);
  } else {
    examId = existingExam.id;
    await run(
      `UPDATE Exams SET title = ?, subject = ?, duration_minutes = ?, total_questions = ?, max_marks = ?, is_active = ? WHERE id = ?`,
      ['Web Technologies & Database Systems', 'Computer Science', 30, 12, 12.0, 1, examId]
    );
    console.log(`Exam exists: ${mainExamCode} (ID: ${examId})`);
  }

  // 4. Seed Questions for WTDB2026
  console.log('--- Seeding Questions ---');
  const questionsData = [
    // JavaScript (Topic 1)
    {
      topic: 'JavaScript',
      question_text: 'What is the output of `typeof NaN` in standard ECMAScript / JavaScript?',
      option_a: 'undefined',
      option_b: 'number',
      option_c: 'nan',
      option_d: 'object',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'JavaScript',
      question_text: 'Which JavaScript method creates a new array populated with the results of calling a provided function on every element?',
      option_a: 'forEach()',
      option_b: 'filter()',
      option_c: 'map()',
      option_d: 'reduce()',
      correct_option: 'C',
      marks: 1.0
    },
    {
      topic: 'JavaScript',
      question_text: 'In JavaScript event handling, which phase occurs first when an event is dispatched to a target element?',
      option_a: 'Bubbling phase',
      option_b: 'Capturing / Trickling phase',
      option_c: 'Target phase',
      option_d: 'Dispatch phase',
      correct_option: 'B',
      marks: 1.0
    },

    // HTML/CSS & DOM (Topic 2)
    {
      topic: 'HTML/CSS',
      question_text: 'In the CSS Box Model, which layer is immediately surrounding the content area before border and margin?',
      option_a: 'Outline',
      option_b: 'Padding',
      option_c: 'Border',
      option_d: 'Margin',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'HTML/CSS',
      question_text: 'Which CSS Flexbox property controls the alignment of flex items along the cross axis?',
      option_a: 'justify-content',
      option_b: 'align-items',
      option_c: 'flex-direction',
      option_d: 'align-content',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'HTML/CSS',
      question_text: 'Which HTML5 semantic element is most suitable for representing an independent, self-contained piece of composition such as a blog post or news story?',
      option_a: '<section>',
      option_b: '<aside>',
      option_c: '<article>',
      option_d: '<div>',
      correct_option: 'C',
      marks: 1.0
    },

    // Relational Databases & SQL (Topic 3)
    {
      topic: 'SQL & Databases',
      question_text: 'Which SQL clause is used to filter records after aggregation by a GROUP BY clause?',
      option_a: 'WHERE',
      option_b: 'ORDER BY',
      option_c: 'HAVING',
      option_d: 'LIMIT',
      correct_option: 'C',
      marks: 1.0
    },
    {
      topic: 'SQL & Databases',
      question_text: 'In database normalization, a table is in Third Normal Form (3NF) if it is in 2NF and contains no:',
      option_a: 'Partial functional dependencies',
      option_b: 'Transitive functional dependencies',
      option_c: 'Multi-valued dependencies',
      option_d: 'Join dependencies',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'SQL & Databases',
      question_text: 'Which ACID property guarantees that once a transaction has been committed, it will remain committed even in the case of a system crash or power outage?',
      option_a: 'Atomicity',
      option_b: 'Consistency',
      option_c: 'Isolation',
      option_d: 'Durability',
      correct_option: 'D',
      marks: 1.0
    },

    // HTTP & Web Architecture (Topic 4)
    {
      topic: 'HTTP & Web Architecture',
      question_text: 'Which HTTP response status code is defined as "403"?',
      option_a: 'Unauthorized',
      option_b: 'Forbidden',
      option_c: 'Not Found',
      option_d: 'Method Not Allowed',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'HTTP & Web Architecture',
      question_text: 'Which HTTP header is commonly set by a server to instruct the client’s browser to prevent cross-site scripting (XSS) attacks by controlling allowed resources?',
      option_a: 'Access-Control-Allow-Origin',
      option_b: 'Content-Security-Policy',
      option_c: 'X-Requested-With',
      option_d: 'Strict-Transport-Security',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'HTTP & Web Architecture',
      question_text: 'An HTTP method is considered "idempotent" if making multiple identical requests has the same effect on the server as a single request. Which of the following is NOT idempotent?',
      option_a: 'GET',
      option_b: 'PUT',
      option_c: 'DELETE',
      option_d: 'POST',
      correct_option: 'D',
      marks: 1.0
    }
  ];

  // Clear existing questions for clean seed
  await run(`DELETE FROM Questions WHERE exam_id = ?`, [examId]);
  for (const q of questionsData) {
    await run(
      `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [examId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks, q.topic]
    );
  }
  console.log(`Seeded ${questionsData.length} questions for exam ${mainExamCode}`);

  // 5. Seed Exam Assignments
  console.log('--- Assigning Exam to Students ---');
  for (const stuNo of ['STU2023001', 'STU2023002', 'STU2023003']) {
    const sId = studentIds[stuNo];
    await run(
      `INSERT INTO Exam_Assignments (exam_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [examId, sId]
    );
    console.log(`Assigned exam ${mainExamCode} to student ${stuNo} (ID: ${sId})`);
  }

  // 6. Seed a Historical Past Exam with completed result for STU2023001
  // This allows the Analytics & Historical Line Chart on Result/Dashboard to display rich data immediately
  console.log('--- Seeding Historical Exam & Completed Attempt ---');
  const pastExamCode = 'WEB101';
  let pastExam = await get(`SELECT id FROM Exams WHERE exam_code = ?`, [pastExamCode]);
  let pastExamId;
  if (!pastExam) {
    const res = await run(
      `INSERT INTO Exams (title, subject, exam_code, duration_minutes, total_questions, max_marks, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Diagnostic Test: Internet & Web Basics',
        'Web Technologies',
        pastExamCode,
        20,
        5,
        5.0,
        1
      ]
    );
    pastExamId = res.id;
  } else {
    pastExamId = pastExam.id;
  }

  // Assign past exam to STU2023001
  await run(
    `INSERT INTO Exam_Assignments (exam_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
    [pastExamId, studentIds['STU2023001']]
  );

  // Past exam questions
  const pastQuestions = [
    { text: 'Which tag defines a hyperlink in HTML?', a: '<a>', b: '<link>', c: '<href>', d: '<url>', correct: 'A', topic: 'HTML/CSS' },
    { text: 'Which CSS property changes the text color?', a: 'text-color', b: 'color', c: 'font-color', d: 'foreground', correct: 'B', topic: 'HTML/CSS' },
    { text: 'What does SQL stand for?', a: 'Structured Query Language', b: 'Simple Query Language', c: 'Sequential Query Logic', d: 'Standard Question Language', correct: 'A', topic: 'SQL & Databases' },
    { text: 'Which status code means OK in HTTP?', a: '200', b: '201', c: '204', d: '301', correct: 'A', topic: 'HTTP & Web Architecture' },
    { text: 'Which keyword declares a block-scoped variable in modern JS?', a: 'var', b: 'let', c: 'set', d: 'define', correct: 'B', topic: 'JavaScript' }
  ];

  await run(`DELETE FROM Questions WHERE exam_id = ?`, [pastExamId]);
  const pastQIds = [];
  for (const pq of pastQuestions) {
    const r = await run(
      `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pastExamId, pq.text, pq.a, pq.b, pq.c, pq.d, pq.correct, 1.0, pq.topic]
    );
    pastQIds.push({ id: r.id, correct: pq.correct });
  }

  // Create completed attempt for STU2023001 if not already present
  const existingAttempt = await get(
    `SELECT id FROM Exam_Attempts WHERE exam_id = ? AND student_id = ?`,
    [pastExamId, studentIds['STU2023001']]
  );
  if (!existingAttempt) {
    const startTime = new Date(Date.now() - 3600000 * 24).toISOString(); // 1 day ago
    const endTime = new Date(Date.now() - 3600000 * 24 + 15 * 60000).toISOString();
    const attRes = await run(
      `INSERT INTO Exam_Attempts (exam_id, student_id, start_time, end_time, status, total_score)
       VALUES (?, ?, ?, ?, 'completed', 4.0)`,
      [pastExamId, studentIds['STU2023001'], startTime, endTime]
    );
    const attemptId = attRes.id;

    // Student answers: 4 correct, 1 incorrect
    const answers = [
      { qId: pastQIds[0].id, ans: 'A', isCorr: 1, marks: 1.0 },
      { qId: pastQIds[1].id, ans: 'B', isCorr: 1, marks: 1.0 },
      { qId: pastQIds[2].id, ans: 'A', isCorr: 1, marks: 1.0 },
      { qId: pastQIds[3].id, ans: 'A', isCorr: 1, marks: 1.0 },
      { qId: pastQIds[4].id, ans: 'A', isCorr: 0, marks: 0.0 } // chose 'A' instead of 'B'
    ];

    for (const ans of answers) {
      await run(
        `INSERT INTO Student_Answers (attempt_id, question_id, selected_option, is_correct, marks_awarded, is_marked_for_review)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [attemptId, ans.qId, ans.ans, ans.isCorr, ans.marks]
      );
    }

    // Insert Result
    await run(
      `INSERT INTO Results (attempt_id, student_id, exam_id, total_questions, attempted_questions, correct_answers, incorrect_answers, unanswered_questions, total_marks_obtained, max_marks, percentage, accuracy, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [attemptId, studentIds['STU2023001'], pastExamId, 5, 5, 4, 1, 0, 4.0, 5.0, 80.0, 80.0, endTime]
    );
    console.log(`Seeded past completed exam attempt & result for STU2023001 (Attempt ID: ${attemptId})`);
  }

  // 7. Seed Demo Exam: Mobile Programming & Responsive Web
  console.log('--- Seeding Demo Exam: Mobile Programming & Responsive Web ---');
  const demoExamCode = 'DEMO2026';
  let demoExamId;
  const existingDemoExam = await get(`SELECT id FROM Exams WHERE exam_code = ?`, [demoExamCode]);
  if (!existingDemoExam) {
    const res = await run(
      `INSERT INTO Exams (title, subject, exam_code, duration_minutes, total_questions, max_marks, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Mobile Programming & Responsive Web (Demo)',
        'Mobile Programming',
        demoExamCode,
        15,
        6,
        6.0,
        1
      ]
    );
    demoExamId = res.id;
    console.log(`Created demo exam: ${demoExamCode} (ID: ${demoExamId})`);
  } else {
    demoExamId = existingDemoExam.id;
    await run(
      `UPDATE Exams SET title = ?, subject = ?, duration_minutes = ?, total_questions = ?, max_marks = ?, is_active = ? WHERE id = ?`,
      ['Mobile Programming & Responsive Web (Demo)', 'Mobile Programming', 15, 6, 6.0, 1, demoExamId]
    );
    console.log(`Demo exam exists: ${demoExamCode} (ID: ${demoExamId})`);
  }

  // Questions for DEMO2026
  const demoQuestions = [
    {
      topic: 'Android Architecture',
      question_text: 'Which primary Android component is responsible for providing a visual user interface and responding to screen interactions?',
      option_a: 'BroadcastReceiver',
      option_b: 'Activity',
      option_c: 'ContentProvider',
      option_d: 'Service',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'Responsive Design',
      question_text: 'In responsive CSS design, which CSS media feature is standard for targeting screen widths on handheld mobile devices?',
      option_a: 'max-width',
      option_b: 'orientation-lock',
      option_c: 'device-dpi',
      option_d: 'screen-ratio',
      correct_option: 'A',
      marks: 1.0
    },
    {
      topic: 'Android Lifecycle',
      question_text: 'In the Android Activity lifecycle, which method is called immediately before an Activity becomes visible to the user?',
      option_a: 'onPause()',
      option_b: 'onStop()',
      option_c: 'onStart()',
      option_d: 'onDestroy()',
      correct_option: 'C',
      marks: 1.0
    },
    {
      topic: 'Progressive Web Apps',
      question_text: 'Which browser API acts as a client-side programmable network proxy enabling offline capabilities and caching for PWAs?',
      option_a: 'Web Worker',
      option_b: 'Service Worker',
      option_c: 'LocalStorage',
      option_d: 'IndexedDB API',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'Mobile UI Layout',
      question_text: 'Which layout container in Android UI development arranges its child views sequentially in a single direction (vertical or horizontal)?',
      option_a: 'FrameLayout',
      option_b: 'LinearLayout',
      option_c: 'ConstraintLayout',
      option_d: 'CoordinatorLayout',
      correct_option: 'B',
      marks: 1.0
    },
    {
      topic: 'REST & Mobile APIs',
      question_text: 'Which data format is the de facto standard for exchanging lightweight structured data between mobile applications and Express.js REST backends?',
      option_a: 'XML',
      option_b: 'JSON',
      option_c: 'YAML',
      option_d: 'CSV',
      correct_option: 'B',
      marks: 1.0
    }
  ];

  await run(`DELETE FROM Questions WHERE exam_id = ?`, [demoExamId]);
  for (const q of demoQuestions) {
    await run(
      `INSERT INTO Questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [demoExamId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks, q.topic]
    );
  }
  console.log(`Seeded ${demoQuestions.length} questions for exam ${demoExamCode}`);

  // Assign demo exam to all registered students
  for (const stuNo of ['STU2023001', 'STU2023002', 'STU2023003']) {
    const sId = studentIds[stuNo];
    if (sId) {
      await run(
        `INSERT INTO Exam_Assignments (exam_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
        [demoExamId, sId]
      );
      console.log(`Assigned demo exam ${demoExamCode} to student ${stuNo}`);
    }
  }

  console.log('--- Database Seeding Complete ---');
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seed executed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
