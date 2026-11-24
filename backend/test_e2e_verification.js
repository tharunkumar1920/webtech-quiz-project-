const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const assert = require('assert');

// Point DB to fresh temporary copy so we don't pollute seeded database
const srcDb = path.join(__dirname, 'database', 'exam_portal.sqlite');
const testDb = path.join(os.tmpdir(), `test_e2e_${Date.now()}.sqlite`);
if (fs.existsSync(srcDb)) {
  fs.copyFileSync(srcDb, testDb);
}
process.env.DB_PATH = testDb;

const app = require('./server');

let server;
const pipeName = `\\\\.\\pipe\\exam_e2e_pipe_${Date.now()}`;
let cookieJar = {
  student: '',
  admin: '',
  unauth: ''
};

function runHttp(method, urlPath, body = null, sessionType = 'unauth') {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'host': `localhost:3000`
    };

    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (cookieJar[sessionType]) {
      headers['Cookie'] = cookieJar[sessionType];
    }

    const options = {
      socketPath: pipeName,
      path: urlPath,
      method: method.toUpperCase(),
      headers: headers
    };

    const req = http.request(options, (res) => {
      // capture set-cookie
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        cookieJar[sessionType] = raw.split(';')[0];
      }

      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(resData);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          text: resData
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('======================================================================');
  console.log('>>> STARTING COMPREHENSIVE E2E VERIFICATION SUITE <<<');
  console.log('======================================================================\n');

  // Start HTTP Server on named pipe
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(pipeName, () => {
      console.log(`[SETUP] In-process test server listening on pipe ${pipeName}`);
      resolve();
    });
  });

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    return (async () => {
      try {
        await fn();
        passedTests++;
        console.log(`  [PASS] Test ${totalTests}: ${name}`);
      } catch (err) {
        console.error(`  [FAIL] Test ${totalTests}: ${name}`);
        console.error(`         Error: ${err.message}`);
        throw err;
      }
    })();
  }

  try {
    // 1. Health check & Static File Serving
    await test('Server health check endpoint responds with 200 and status ok', async () => {
      const res = await runHttp('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'ok');
    });

    await test('Frontend HTML routes respond with 200 OK and valid HTML', async () => {
      const indexRes = await runHttp('GET', '/');
      assert.strictEqual(indexRes.status, 200);
      assert.ok(indexRes.text.includes('EduQuest') || indexRes.text.includes('Quiz'));

      const dashRes = await runHttp('GET', '/dashboard');
      assert.strictEqual(dashRes.status, 200);
      assert.ok(dashRes.text.includes('Learner') || dashRes.text.includes('EduQuest'));

      const examRes = await runHttp('GET', '/exam');
      assert.strictEqual(examRes.status, 200);
      assert.ok(examRes.text.includes('Question Palette'));

      const resultRes = await runHttp('GET', '/result');
      assert.strictEqual(resultRes.status, 200);
      assert.ok(resultRes.text.includes('Performance') || resultRes.text.includes('Report'));

      const adminRes = await runHttp('GET', '/admin');
      assert.strictEqual(adminRes.status, 200);
      assert.ok(adminRes.text.includes('Studio') || adminRes.text.includes('Admin'));
    });

    // 2. Auth Edge Cases & Negative Tests
    await test('Empty credentials rejected on student login (400)', async () => {
      const res = await runHttp('POST', '/api/auth/student/login', { enrollment_no: '', password: '' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
    });

    await test('Invalid credentials rejected on student login (401)', async () => {
      const res = await runHttp('POST', '/api/auth/student/login', { enrollment_no: 'STU2023001', password: 'wrongpassword' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
    });

    await test('Non-existent student enrollment rejected (401)', async () => {
      const res = await runHttp('POST', '/api/auth/student/login', { enrollment_no: 'UNKNOWN999', password: 'student123' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
    });

    await test('Unauthenticated access to protected routes is blocked (401)', async () => {
      const examRes = await runHttp('GET', '/api/exams/my-exams', null, 'unauth');
      assert.strictEqual(examRes.status, 401);

      const adminRes = await runHttp('GET', '/api/admin/students', null, 'unauth');
      assert.strictEqual(adminRes.status, 401);
    });

    // 3. Student Journey
    await test('Student login succeeds with seeded credentials (STU2023001 / student123)', async () => {
      const res = await runHttp('POST', '/api/auth/student/login', {
        enrollment_no: 'STU2023001',
        password: 'student123'
      }, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.enrollment_no, 'STU2023001');
      assert.strictEqual(res.data.user.role, 'student');
      assert.strictEqual(res.data.user.name, 'Tharun Kumar');
    });

    await test('GET /api/auth/me returns student session metadata', async () => {
      const res = await runHttp('GET', '/api/auth/me', null, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.authenticated, true);
      assert.strictEqual(res.data.user.enrollment_no, 'STU2023001');
    });

    let mainExam = null;
    await test('GET /api/exams/my-exams returns assigned exams including WTDB2026', async () => {
      const res = await runHttp('GET', '/api/exams/my-exams', null, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.exams));
      assert.ok(res.data.exams.length >= 2);

      mainExam = res.data.exams.find(e => e.title.includes('Web Technologies'));
      assert.ok(mainExam, 'WTDB2026 exam should be assigned');
      assert.strictEqual(mainExam.status, 'not_started');
      assert.strictEqual(mainExam.total_questions, 12);
    });

    await test('Exam code verification rejects wrong code (400)', async () => {
      const res = await runHttp('POST', '/api/exams/verify-code', {
        exam_id: mainExam.id,
        exam_code: 'WRONGCODE'
      }, 'student');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
    });

    await test('Exam code verification succeeds with valid passcode WTDB2026', async () => {
      const res = await runHttp('POST', '/api/exams/verify-code', {
        exam_id: mainExam.id,
        exam_code: 'WTDB2026'
      }, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.exam.id, mainExam.id);
    });

    let attemptData = null;
    let examQuestions = null;
    await test('POST /api/exams/start initializes attempt and returns questions WITHOUT correct answers', async () => {
      const res = await runHttp('POST', '/api/exams/start', {
        exam_id: mainExam.id,
        exam_code: 'WTDB2026'
      }, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.attempt);
      assert.ok(res.data.attempt.id);
      attemptData = res.data.attempt;
      examQuestions = res.data.questions;
      assert.strictEqual(examQuestions.length, 12);

      // CRITICAL SECURITY AUDIT: Verify correct_option is NEVER leaked
      examQuestions.forEach((q, idx) => {
        assert.strictEqual(q.correct_option, undefined, `Question ${idx + 1} leaked correct_option!`);
        assert.strictEqual(q.answer, undefined, `Question ${idx + 1} leaked answer!`);
        assert.ok(q.option_a && q.option_b && q.option_c && q.option_d, `Question ${idx + 1} missing options`);
        assert.ok(q.topic, `Question ${idx + 1} missing topic`);
      });
    });

    await test('POST /api/exams/save-answer saves answers and review status', async () => {
      // Answer Q1 with 'B'
      const save1 = await runHttp('POST', '/api/exams/save-answer', {
        attempt_id: attemptData.id,
        question_id: examQuestions[0].id,
        selected_option: 'B',
        is_marked_for_review: false
      }, 'student');
      assert.strictEqual(save1.status, 200);
      assert.strictEqual(save1.data.success, true);

      // Answer Q2 with 'C' and mark for review
      const save2 = await runHttp('POST', '/api/exams/save-answer', {
        attempt_id: attemptData.id,
        question_id: examQuestions[1].id,
        selected_option: 'C',
        is_marked_for_review: true
      }, 'student');
      assert.strictEqual(save2.status, 200);
      assert.strictEqual(save2.data.success, true);

      // Answer Q3 with 'B'
      const save3 = await runHttp('POST', '/api/exams/save-answer', {
        attempt_id: attemptData.id,
        question_id: examQuestions[2].id,
        selected_option: 'B',
        is_marked_for_review: false
      }, 'student');
      assert.strictEqual(save3.status, 200);

      // Answer Q4 with 'B'
      const save4 = await runHttp('POST', '/api/exams/save-answer', {
        attempt_id: attemptData.id,
        question_id: examQuestions[3].id,
        selected_option: 'B',
        is_marked_for_review: false
      }, 'student');
      assert.strictEqual(save4.status, 200);
    });

    await test('Resuming in-progress exam preserves saved answers', async () => {
      const res = await runHttp('POST', '/api/exams/start', {
        exam_id: mainExam.id
      }, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.attempt.id, attemptData.id);
      assert.ok(res.data.saved_answers);
      const q1Saved = res.data.saved_answers[examQuestions[0].id];
      assert.ok(q1Saved);
      assert.strictEqual(q1Saved.selected_option, 'B');
    });

    let submissionSummary = null;
    await test('POST /api/exams/submit computes score server-side and finishes exam', async () => {
      const res = await runHttp('POST', '/api/exams/submit', {
        attempt_id: attemptData.id
      }, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      submissionSummary = res.data.summary;
      assert.strictEqual(submissionSummary.total_questions, 12);
      assert.strictEqual(submissionSummary.attempted_questions, 4);
      assert.strictEqual(submissionSummary.unanswered_questions, 8);
      assert.ok(submissionSummary.total_marks_obtained >= 0);
    });

    await test('Preventing exam re-taking after completion (400) and preventing modifying submitted answers', async () => {
      // 1. Re-submitting is handled idempotently without re-evaluating
      const resubRes = await runHttp('POST', '/api/exams/submit', {
        attempt_id: attemptData.id
      }, 'student');
      assert.strictEqual(resubRes.status, 200);
      assert.ok(resubRes.data.message.includes('already been submitted'));

      // 2. Modifying answers after completion is strictly rejected with 400
      const modifyRes = await runHttp('POST', '/api/exams/save-answer', {
        attempt_id: attemptData.id,
        question_id: examQuestions[0].id,
        selected_option: 'A',
        is_marked_for_review: false
      }, 'student');
      assert.strictEqual(modifyRes.status, 400);
      assert.strictEqual(modifyRes.data.success, false);
      assert.ok(modifyRes.data.error.includes('already submitted'));

      // 3. Re-Exam: Starting the exam again with code creates a new attempt (Attempt #2)
      const retakeStartRes = await runHttp('POST', '/api/exams/start', {
        exam_id: mainExam.id,
        exam_code: 'WTDB2026',
        retake: true
      }, 'student');
      assert.strictEqual(retakeStartRes.status, 200);
      assert.strictEqual(retakeStartRes.data.success, true);
      assert.ok(retakeStartRes.data.attempt.id > attemptData.id, 'New attempt record created in database');
      assert.strictEqual(retakeStartRes.data.attempt.attempt_number, 2);

      const retakeAttemptId = retakeStartRes.data.attempt.id;

      // Answer question 1 and 2 on retake
      await runHttp('POST', '/api/exams/save-answer', {
        attempt_id: retakeAttemptId,
        question_id: examQuestions[0].id,
        selected_option: examQuestions[0].correct_option || 'B'
      }, 'student');

      // Submit re-exam
      const retakeSubmitRes = await runHttp('POST', '/api/exams/submit', {
        attempt_id: retakeAttemptId
      }, 'student');
      assert.strictEqual(retakeSubmitRes.status, 200);

      // Verify that Old vs New comparative analysis is computed!
      const compRes = await runHttp('GET', `/api/results/${retakeAttemptId}`, null, 'student');
      assert.strictEqual(compRes.status, 200);
      assert.ok(compRes.data.comparison, 'Comparison object present');
      assert.strictEqual(compRes.data.comparison.has_comparison, true);
      assert.strictEqual(compRes.data.comparison.new_attempt_number, 2);
      assert.strictEqual(compRes.data.comparison.old_attempt_number, 1);
      assert.ok(Array.isArray(compRes.data.comparison.question_comparisons));
      assert.ok(Array.isArray(compRes.data.comparison.topic_comparison));
    });

    await test('GET /api/results/:attemptId provides complete data for 4 Chart.js charts and analysis', async () => {
      const res = await runHttp('GET', `/api/results/${attemptData.id}`, null, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);

      const r = res.data.result;
      assert.ok(r, 'Result record missing');
      assert.strictEqual(r.total_questions, 12);

      // Verify Chart 1 Data: Breakdown
      assert.strictEqual(typeof r.correct_answers, 'number');
      assert.strictEqual(typeof r.incorrect_answers, 'number');
      assert.strictEqual(typeof r.unanswered_questions, 'number');

      // Verify Chart 2 Data: Topic Breakdown
      const topics = res.data.topic_breakdown;
      assert.ok(Array.isArray(topics) && topics.length > 0, 'Topic breakdown missing');
      topics.forEach(t => {
        assert.ok(t.topic, 'Topic name missing');
        assert.ok(t.score_percentage !== undefined, 'Topic score percentage missing');
        assert.ok(t.accuracy !== undefined, 'Topic accuracy missing');
      });

      // Verify Chart 3 Data: Historical Trends
      const hist = res.data.historical_trends;
      assert.ok(Array.isArray(hist) && hist.length >= 2, 'Historical trends should include past WEB101 and current attempt');

      // Verify Chart 4 Data: Topic Accuracy
      assert.ok(topics.every(t => typeof t.accuracy === 'number'), 'Topic accuracy numbers required');

      // Verify Comprehensive Analysis Object
      const analysis = res.data.analysis;
      assert.ok(analysis.overall_assessment, 'Overall assessment text missing');
      assert.ok(analysis.strongest_topic, 'Strongest topic missing');
      assert.ok(analysis.weakest_topic, 'Weakest topic missing');
      assert.ok(Array.isArray(analysis.improvement_topics), 'Improvement topics missing');
      assert.ok(Array.isArray(analysis.recommendations), 'Recommendations missing');
    });

    await test('GET /api/results/my-results lists all completed exams for student', async () => {
      const res = await runHttp('GET', '/api/results/my-results', null, 'student');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.results.length >= 2);
    });

    // 4. Admin Journey
    await test('Admin login with admin / admin123 succeeds', async () => {
      const res = await runHttp('POST', '/api/auth/admin/login', {
        username: 'admin',
        password: 'admin123'
      }, 'admin');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.role, 'admin');
    });

    let newStudentId = null;
    await test('Admin can list and create new students (POST /api/admin/students)', async () => {
      const listRes = await runHttp('GET', '/api/admin/students', null, 'admin');
      assert.strictEqual(listRes.status, 200);
      assert.ok(listRes.data.students.length >= 3);

      const createRes = await runHttp('POST', '/api/admin/students', {
        enrollment_no: `TEST_STU_${Date.now()}`,
        name: 'Automated Test Student',
        email: `auto_${Date.now()}@university.edu`,
        password: 'student123',
        department: 'Information Science',
        course: 'B.Tech IT',
        semester: 4
      }, 'admin');
      assert.strictEqual(createRes.status, 201);
      assert.strictEqual(createRes.data.success, true);
      newStudentId = createRes.data.student.id;
      assert.ok(newStudentId);
    });

    await test('Admin can update student record (PUT /api/admin/students/:id)', async () => {
      const updateRes = await runHttp('PUT', `/api/admin/students/${newStudentId}`, {
        name: 'Automated Student Updated',
        department: 'Artificial Intelligence',
        course: 'B.Tech AI&DS',
        semester: 5
      }, 'admin');
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.student.name, 'Automated Student Updated');
    });

    let newExamId = null;
    await test('Admin can create a new exam (POST /api/admin/exams)', async () => {
      const createRes = await runHttp('POST', '/api/admin/exams', {
        title: 'Cloud Computing Fundamentals',
        subject: 'Computer Science',
        exam_code: `CLOUD_${Date.now().toString().slice(-4)}`,
        duration_minutes: 45,
        total_questions: 10,
        max_marks: 10
      }, 'admin');
      assert.strictEqual(createRes.status, 201);
      newExamId = createRes.data.exam.id;
      assert.ok(newExamId);
    });

    await test('Admin can toggle exam active status (PUT /api/admin/exams/:id/toggle)', async () => {
      const toggle1 = await runHttp('PUT', `/api/admin/exams/${newExamId}/toggle`, null, 'admin');
      assert.strictEqual(toggle1.status, 200);
      assert.strictEqual(toggle1.data.exam.is_active, 0);

      const toggle2 = await runHttp('PUT', `/api/admin/exams/${newExamId}/toggle`, null, 'admin');
      assert.strictEqual(toggle2.status, 200);
      assert.strictEqual(toggle2.data.exam.is_active, 1);
    });

    await test('Admin can assign exam to students (POST /api/admin/exams/:id/assign)', async () => {
      const assignRes = await runHttp('POST', `/api/admin/exams/${newExamId}/assign`, {
        student_ids: [newStudentId]
      }, 'admin');
      assert.strictEqual(assignRes.status, 200);
      assert.strictEqual(assignRes.data.assigned_count, 1);
    });

    let newQuestionId = null;
    await test('Admin can add questions with options and topic (POST /api/admin/questions)', async () => {
      const qRes = await runHttp('POST', '/api/admin/questions', {
        exam_id: newExamId,
        question_text: 'Which cloud model provides virtual machines on demand?',
        option_a: 'SaaS',
        option_b: 'PaaS',
        option_c: 'IaaS',
        option_d: 'FaaS',
        correct_option: 'C',
        marks: 1.0,
        topic: 'Cloud Models'
      }, 'admin');
      assert.strictEqual(qRes.status, 201);
      newQuestionId = qRes.data.question.id;
      assert.ok(newQuestionId);
    });

    await test('Admin can edit question (PUT /api/admin/questions/:id)', async () => {
      const editRes = await runHttp('PUT', `/api/admin/questions/${newQuestionId}`, {
        exam_id: newExamId,
        question_text: 'Which cloud model provides raw virtualized infrastructure (VMs, storage)?',
        option_a: 'SaaS',
        option_b: 'PaaS',
        option_c: 'IaaS (Infrastructure as a Service)',
        option_d: 'FaaS',
        correct_option: 'C',
        marks: 1.0,
        topic: 'Cloud Infrastructure'
      }, 'admin');
      assert.strictEqual(editRes.status, 200);
      assert.strictEqual(editRes.data.question.topic, 'Cloud Infrastructure');
    });

    await test('Admin can list questions by exam (GET /api/admin/exams/:examId/questions)', async () => {
      const listQRes = await runHttp('GET', `/api/admin/exams/${newExamId}/questions`, null, 'admin');
      assert.strictEqual(listQRes.status, 200);
      assert.strictEqual(listQRes.data.questions.length, 1);
    });

    await test('Admin can delete question (DELETE /api/admin/questions/:id)', async () => {
      const delRes = await runHttp('DELETE', `/api/admin/questions/${newQuestionId}`, null, 'admin');
      assert.strictEqual(delRes.status, 200);
      assert.strictEqual(delRes.data.success, true);
    });

    await test('Admin can view all results and export CSV (GET /api/admin/results/export)', async () => {
      const resultsRes = await runHttp('GET', '/api/admin/results', null, 'admin');
      assert.strictEqual(resultsRes.status, 200);
      assert.ok(resultsRes.data.results.length >= 2);

      const exportRes = await runHttp('GET', '/api/admin/results/export', null, 'admin');
      assert.strictEqual(exportRes.status, 200);
      assert.ok(exportRes.headers['content-type'].includes('text/csv'));
      assert.ok(exportRes.headers['content-disposition'].includes('attachment'));
      assert.ok(exportRes.text.includes('Enrollment Number'));
      assert.ok(exportRes.text.includes('STU2023001'));
      assert.ok(exportRes.text.includes('Web Technologies & Database Systems'));
    });

    // 5. Simultaneous Quiz & Question Creation + Learner Self-Registration
    await test('Learner can register directly via POST /api/auth/student/register', async () => {
      const regRes = await runHttp('POST', '/api/auth/student/register', {
        name: 'New Self Registered Learner',
        email: `self_${Date.now()}@learning.edu`,
        enrollment_no: `LRN${Date.now().toString().slice(-6)}`,
        password: 'securepass123',
        department: 'Interactive Computing',
        course: 'B.Tech'
      }, 'registered_student');

      assert.strictEqual(regRes.status, 201);
      assert.strictEqual(regRes.data.success, true);
      assert.ok(regRes.data.user.id);
      assert.strictEqual(regRes.data.user.role, 'student');
    });

    await test('Learner can login using their Email address as identifier', async () => {
      const testEmail = `email_login_${Date.now()}@learning.edu`;
      await runHttp('POST', '/api/auth/student/register', {
        name: 'Email Login User',
        email: testEmail,
        password: 'mypassword123'
      }, 'temp_reg');

      const loginRes = await runHttp('POST', '/api/auth/student/login', {
        identifier: testEmail,
        password: 'mypassword123'
      }, 'email_user');

      assert.strictEqual(loginRes.status, 200);
      assert.strictEqual(loginRes.data.success, true);
      assert.strictEqual(loginRes.data.user.email, testEmail);
    });

    await test('Admin can create Quiz AND Question Paper simultaneously (POST /api/admin/exams-with-questions)', async () => {
      const simRes = await runHttp('POST', '/api/admin/exams-with-questions', {
        title: 'Modern Full-Stack Engineering Quiz',
        subject: 'Web Technologies',
        exam_code: `SIMULTANEOUS_${Date.now().toString().slice(-4)}`,
        duration_minutes: 30,
        auto_assign_all: true,
        questions: [
          {
            question_text: 'Which JavaScript keyword declares a block-scoped variable that cannot be reassigned?',
            topic: 'JS Variables',
            marks: 2,
            option_a: 'var',
            option_b: 'const',
            option_c: 'let',
            option_d: 'def',
            correct_option: 'B'
          },
          {
            question_text: 'What does the Promise.all() method return when all promises resolve?',
            topic: 'JS Async',
            marks: 3,
            option_a: 'An array of resolved values',
            option_b: 'A boolean true',
            option_c: 'The first resolved value only',
            option_d: 'A callback function',
            correct_option: 'A'
          }
        ]
      }, 'admin');

      assert.strictEqual(simRes.status, 201);
      assert.strictEqual(simRes.data.success, true);
      assert.strictEqual(simRes.data.questions_count, 2);
      assert.strictEqual(simRes.data.exam.total_questions, 2);
      assert.strictEqual(simRes.data.exam.max_marks, 5);
      assert.ok(simRes.data.assigned_students_count > 0, 'Auto-assigned to existing students in DB');
    });

    // 6. Admin & Instructor Management Suite
    await test('Guest can self-register a new Admin/Instructor via POST /api/auth/admin/register', async () => {
      const regRes = await runHttp('POST', '/api/auth/admin/register', {
        name: 'Dr. Alan Turing',
        username: 'prof_turing',
        password: 'password123',
        role: 'instructor'
      }, 'guest_admin');

      assert.strictEqual(regRes.status, 201);
      assert.strictEqual(regRes.data.success, true);
      assert.strictEqual(regRes.data.user.username, 'prof_turing');
      assert.strictEqual(regRes.data.user.role, 'admin'); // grants administrative dashboard access

      // Duplicate registration rejected
      const dupRes = await runHttp('POST', '/api/auth/admin/register', {
        name: 'Duplicate Turing',
        username: 'prof_turing',
        password: 'password123'
      }, 'guest_admin');
      assert.strictEqual(dupRes.status, 400);
    });

    await test('Admin can list all instructors via GET /api/admin/instructors', async () => {
      const res = await runHttp('GET', '/api/admin/instructors', null, 'admin');
      assert.strictEqual(res.status, 200);
      const instructors = Array.isArray(res.data) ? res.data : (res.data?.instructors || []);
      assert.ok(Array.isArray(instructors));
      assert.ok(instructors.length >= 2, 'Should contain seeded admin and registered instructor');
      const found = instructors.find(i => i.username === 'prof_turing');
      assert.ok(found, 'Newly registered instructor should appear in list');
    });

    let createdStaffId = null;
    await test('Admin can create a new instructor via POST /api/admin/instructors', async () => {
      const createRes = await runHttp('POST', '/api/admin/instructors', {
        name: 'Prof. Grace Hopper',
        username: 'prof_hopper',
        password: 'compiler123',
        role: 'instructor'
      }, 'admin');

      assert.strictEqual(createRes.status, 201);
      assert.strictEqual(createRes.data.success, true);
      assert.strictEqual(createRes.data.instructor.username, 'prof_hopper');
      createdStaffId = createRes.data.instructor.id;
    });

    await test('Newly created instructor can log in and view dashboard', async () => {
      const loginRes = await runHttp('POST', '/api/auth/admin/login', {
        username: 'prof_hopper',
        password: 'compiler123'
      }, 'hopper_session');

      assert.strictEqual(loginRes.status, 200);
      assert.strictEqual(loginRes.data.user.username, 'prof_hopper');
      assert.strictEqual(loginRes.data.user.role, 'admin');
    });

    await test('Admin cannot delete their own account (protection guard)', async () => {
      // First get current admin ID
      const meRes = await runHttp('GET', '/api/auth/me', null, 'admin');
      const adminId = meRes.data.user.id;

      const delSelfRes = await runHttp('DELETE', `/api/admin/instructors/${adminId}`, null, 'admin');
      assert.strictEqual(delSelfRes.status, 400);
      const errMsg = delSelfRes.data.message || delSelfRes.data.error || '';
      assert.ok(errMsg.includes('cannot remove your own'));
    });

    await test('Admin can delete an instructor via DELETE /api/admin/instructors/:id', async () => {
      assert.ok(createdStaffId, 'Staff ID must exist from previous test');
      const delRes = await runHttp('DELETE', `/api/admin/instructors/${createdStaffId}`, null, 'admin');
      assert.strictEqual(delRes.status, 200);
      assert.strictEqual(delRes.data.success, true);

      // Verify instructor no longer appears
      const listRes = await runHttp('GET', '/api/admin/instructors', null, 'admin');
      const instructors = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.instructors || []);
      const found = instructors.find(i => i.id === createdStaffId);
      assert.strictEqual(found, undefined);
    });

    // 7. Cross-role Authorization Guards
    await test('Student cannot access admin routes (403/401)', async () => {
      const res = await runHttp('GET', '/api/admin/students', null, 'student');
      assert.strictEqual(res.status, 403);
    });

    await test('Student cannot view another student result (403)', async () => {
      // Login as STU2023002
      await runHttp('POST', '/api/auth/student/login', {
        enrollment_no: 'STU2023002',
        password: 'student123'
      }, 'student2');

      // Attempt to view attemptData.id owned by STU2023001
      const res = await runHttp('GET', `/api/results/${attemptData.id}`, null, 'student2');
      assert.strictEqual(res.status, 403);
    });

    await test('POST /api/auth/logout terminates session', async () => {
      const logoutRes = await runHttp('POST', '/api/auth/logout', null, 'student');
      assert.strictEqual(logoutRes.status, 200);

      const meRes = await runHttp('GET', '/api/auth/me', null, 'student');
      assert.strictEqual(meRes.data.authenticated, false);
    });

    console.log('\n======================================================================');
    console.log(`>>> E2E VERIFICATION COMPLETED: ALL ${passedTests}/${totalTests} TESTS PASSED! <<<`);
    console.log('======================================================================\n');

  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
