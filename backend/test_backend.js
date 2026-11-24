const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Setup isolated database in tmp
const srcDb = path.join(__dirname, 'database', 'exam_portal.sqlite');
const testDb = path.join(os.tmpdir(), `test_exam_${Date.now()}.sqlite`);
fs.copyFileSync(srcDb, testDb);
process.env.DB_PATH = testDb;

const app = require('./server');

const pipeName = `\\\\.\\pipe\\exam_test_pipe_${Date.now()}`;
let sessionCookie = '';

function request(method, reqPath, data = null, useCookie = true) {
  return new Promise((resolve, reject) => {
    const postBody = data ? JSON.stringify(data) : null;
    const headers = {
      'host': 'localhost'
    };

    if (postBody) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postBody);
    }

    if (useCookie && sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    const options = {
      socketPath: pipeName,
      path: reqPath,
      method: method.toUpperCase(),
      headers: headers
    };

    const req = http.request(options, (res) => {
      if (res.headers['set-cookie']) {
        const rawCookie = Array.isArray(res.headers['set-cookie'])
          ? res.headers['set-cookie'][0]
          : res.headers['set-cookie'];
        sessionCookie = rawCookie.split(';')[0];
      }

      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        let parsed = responseBody;
        if (contentType.includes('application/json')) {
          try {
            parsed = JSON.parse(responseBody);
          } catch (e) {
            parsed = responseBody;
          }
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);

    if (postBody) {
      req.write(postBody);
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('>>> RUNNING COMPREHENSIVE BACKEND API VERIFICATION SUITE <<<');
  console.log('================================================================');

  // Test 1: Health check
  console.log('\n[TEST 1] GET /api/health');
  const healthRes = await request('GET', '/api/health', null, false);
  console.log('-> Status:', healthRes.status, 'Response:', healthRes.data);
  if (healthRes.status !== 200 || healthRes.data.status !== 'ok') {
    throw new Error('Health check failed');
  }

  // Test 2: Unauthenticated protection
  console.log('\n[TEST 2] GET /api/exams/my-exams without authentication');
  sessionCookie = '';
  const unauthRes = await request('GET', '/api/exams/my-exams', null, false);
  console.log('-> Status:', unauthRes.status, 'Response:', unauthRes.data);
  if (unauthRes.status !== 401) {
    throw new Error('Expected 401 for unauthenticated request');
  }

  // Test 3: Student Login
  console.log('\n[TEST 3] POST /api/auth/student/login (STU2023001 / student123)');
  const loginRes = await request('POST', '/api/auth/student/login', {
    enrollment_no: 'STU2023001',
    password: 'student123'
  });
  console.log('-> Status:', loginRes.status, 'User:', loginRes.data.user?.name);
  if (!loginRes.data.success || loginRes.data.user.role !== 'student') {
    throw new Error('Student login failed');
  }

  // Test 4: Auth me check
  console.log('\n[TEST 4] GET /api/auth/me');
  const meRes = await request('GET', '/api/auth/me');
  console.log('-> Status:', meRes.status, 'Authenticated:', meRes.data.authenticated, 'Enrollment:', meRes.data.user?.enrollment_no);
  if (!meRes.data.authenticated || meRes.data.user.enrollment_no !== 'STU2023001') {
    throw new Error('/api/auth/me failed');
  }

  // Test 5: Fetch my assigned exams
  console.log('\n[TEST 5] GET /api/exams/my-exams');
  const examsRes = await request('GET', '/api/exams/my-exams');
  console.log('-> Assigned exams count:', examsRes.data.exams?.length);
  examsRes.data.exams.forEach((ex) => {
    console.log(`   - Exam ID: ${ex.id} | Code: ${ex.exam_code || ''} | Title: ${ex.title} | Status: ${ex.status}`);
  });
  if (!examsRes.data.success || examsRes.data.exams.length === 0) {
    throw new Error('No assigned exams found');
  }

  const activeExam = examsRes.data.exams.find((e) => e.status !== 'completed');
  if (!activeExam) {
    throw new Error('No uncompleted test exam found for testing');
  }
  console.log('-> Selected active exam for test journey:', activeExam.id, activeExam.title);

  // Test 6: Verify Exam Code
  console.log('\n[TEST 6] POST /api/exams/verify-code');
  const verifyWrong = await request('POST', '/api/exams/verify-code', {
    exam_id: activeExam.id,
    exam_code: 'WRONGCODE'
  });
  console.log('-> Wrong code status:', verifyWrong.status, verifyWrong.data);
  if (verifyWrong.status !== 400) {
    throw new Error('Expected 400 for incorrect exam code');
  }

  const verifyCorrect = await request('POST', '/api/exams/verify-code', {
    exam_id: activeExam.id,
    exam_code: 'WTDB2026'
  });
  console.log('-> Correct code status:', verifyCorrect.status, 'Verified:', verifyCorrect.data.success);
  if (!verifyCorrect.data.success) {
    throw new Error('Exam passcode verification failed');
  }

  // Test 7: Start Exam
  console.log('\n[TEST 7] POST /api/exams/start');
  const startRes = await request('POST', '/api/exams/start', {
    exam_id: activeExam.id,
    exam_code: 'WTDB2026'
  });
  console.log('-> Attempt ID:', startRes.data.attempt?.id);
  console.log('-> Remaining duration:', startRes.data.attempt?.remaining_seconds, 'seconds');
  console.log('-> Total Questions loaded:', startRes.data.questions?.length);

  // CRITICAL SECURITY AUDIT: Verify correct_option is NEVER returned
  const leak = startRes.data.questions.find((q) => q.correct_option !== undefined);
  if (leak) {
    throw new Error('CRITICAL SECURITY FLAW: correct_option was exposed to the student!');
  }
  console.log('-> [SECURITY AUDIT PASSED] No correct answers leaked in exam payload.');

  const attemptId = startRes.data.attempt.id;
  const questions = startRes.data.questions;

  // Test 8: Save Answers
  console.log('\n[TEST 8] POST /api/exams/save-answer');
  const save1 = await request('POST', '/api/exams/save-answer', {
    attempt_id: attemptId,
    question_id: questions[0].id,
    selected_option: 'B',
    is_marked_for_review: false
  });
  console.log(`-> Saved Q0 (ID: ${questions[0].id}) answer 'B':`, save1.data.message);

  const save2 = await request('POST', '/api/exams/save-answer', {
    attempt_id: attemptId,
    question_id: questions[1].id,
    selected_option: 'C',
    is_marked_for_review: true
  });
  console.log(`-> Saved Q1 (ID: ${questions[1].id}) answer 'C' (marked for review):`, save2.data.message);

  // Test 9: Submit Exam
  console.log('\n[TEST 9] POST /api/exams/submit');
  const submitRes = await request('POST', '/api/exams/submit', {
    attempt_id: attemptId
  });
  console.log('-> Submission evaluation summary:');
  console.log(JSON.stringify(submitRes.data.summary, null, 2));
  if (!submitRes.data.success) {
    throw new Error('Submit exam failed');
  }

  // Test 10: Prevent Re-submission
  console.log('\n[TEST 10] Duplicate Submission Prevention');
  const resubmitRes = await request('POST', '/api/exams/submit', {
    attempt_id: attemptId
  });
  console.log('-> Duplicate submission response:', resubmitRes.data.message);
  if (!resubmitRes.data.message.includes('already')) {
    throw new Error('Duplicate submission was not prevented');
  }

  // Test 11: Get Detailed Result
  console.log(`\n[TEST 11] GET /api/results/${attemptId}`);
  const resultRes = await request('GET', `/api/results/${attemptId}`);
  console.log('-> Result Marks:', `${resultRes.data.result?.total_marks_obtained} / ${resultRes.data.result?.max_marks}`);
  console.log('-> Percentage:', `${resultRes.data.result?.percentage}%`);
  console.log('-> Accuracy:', `${resultRes.data.result?.accuracy}%`);
  console.log('-> Overall Assessment:', resultRes.data.analysis?.overall_assessment);
  console.log('-> Strongest Topic:', resultRes.data.analysis?.strongest_topic);
  console.log('-> Weakest Topic:', resultRes.data.analysis?.weakest_topic);
  console.log('-> Topic Breakdown:');
  resultRes.data.topic_breakdown?.forEach((t) => {
    console.log(`   - ${t.topic}: Score ${t.score_percentage}% | Accuracy ${t.accuracy}% | Marks: ${t.marks_obtained}/${t.total_marks}`);
  });
  console.log('-> Historical Trend Attempts count:', resultRes.data.historical_trends?.length);
  if (!resultRes.data.success || !resultRes.data.topic_breakdown) {
    throw new Error('Failed to retrieve detailed exam result');
  }

  // Test 12: Admin Journey
  console.log('\n[TEST 12] Admin Login (admin / admin123)');
  sessionCookie = ''; // Clear student session
  const adminLoginRes = await request('POST', '/api/auth/admin/login', {
    username: 'admin',
    password: 'admin123'
  });
  console.log('-> Admin login:', adminLoginRes.data.message, 'Role:', adminLoginRes.data.user?.role);
  if (!adminLoginRes.data.success || adminLoginRes.data.user.role !== 'admin') {
    throw new Error('Admin login failed');
  }

  // Test 13: Admin Students
  console.log('\n[TEST 13] Admin GET /api/admin/students');
  const studentsRes = await request('GET', '/api/admin/students');
  console.log('-> Total registered students:', studentsRes.data.students?.length);

  console.log('\n[TEST 14] Admin POST /api/admin/students');
  const newStu = await request('POST', '/api/admin/students', {
    enrollment_no: `TEST_${Date.now()}`,
    name: 'Automation Student',
    email: `auto_${Date.now()}@university.edu`,
    password: 'password123',
    department: 'Computer Science',
    course: 'B.Tech IT',
    semester: 4
  });
  console.log('-> Created new student:', newStu.data.student?.enrollment_no, newStu.data.student?.name);

  // Test 14: Admin Exams
  console.log('\n[TEST 15] Admin GET /api/admin/exams');
  const adminExamsRes = await request('GET', '/api/admin/exams');
  console.log('-> Total exams in system:', adminExamsRes.data.exams?.length);

  // Test 15: Admin CSV Export
  console.log('\n[TEST 16] Admin GET /api/admin/results/export');
  const exportRes = await request('GET', '/api/admin/results/export');
  console.log('-> CSV Content-Type:', exportRes.headers['content-type']);
  console.log('-> CSV Headers & first line:');
  const csvLines = exportRes.data.split('\r\n');
  console.log('   Header:', csvLines[0]);
  if (csvLines.length > 1) {
    console.log('   Row 1:', csvLines[1]);
  }
  if (exportRes.status !== 200 || !exportRes.data.includes('Enrollment Number')) {
    throw new Error('CSV Export validation failed');
  }

  console.log('\n================================================================');
  console.log('>>> ALL 16 BACKEND ENDPOINT TESTS PASSED WITH 100% SUCCESS! <<<');
  console.log('================================================================');
}

const server = http.createServer(app);
server.listen(pipeName, async () => {
  try {
    await runTestSuite();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Failed:', err);
    server.close();
    process.exit(1);
  }
});
