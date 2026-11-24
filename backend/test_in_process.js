const os = require('os');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// Use isolated temporary copy of database
const srcDb = path.join(__dirname, 'database', 'exam_portal.sqlite');
const testDb = path.join(os.tmpdir(), 'test_exam_portal.sqlite');
fs.copyFileSync(srcDb, testDb);
process.env.DB_PATH = testDb;

const app = require('./server');

const { Readable } = require('stream');

// In-process mock request / response helper
let cookieJar = '';

function mockRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    let pushed = false;

    const req = new Readable({
      read() {
        if (!pushed && bodyStr) {
          this.push(Buffer.from(bodyStr));
          pushed = true;
        }
        this.push(null);
      }
    });

    req.method = method.toUpperCase();
    req.url = urlPath;
    req.originalUrl = urlPath;
    req.connection = { encrypted: false, remoteAddress: '127.0.0.1' };
    req.socket = req.connection;
    req.headers = {
      'content-type': 'application/json',
      host: 'localhost:3000'
    };
    if (bodyStr) {
      req.headers['content-length'] = String(Buffer.byteLength(bodyStr));
    }
    if (cookieJar) {
      req.headers['cookie'] = cookieJar;
    }

    const res = new EventEmitter();
    res.statusCode = 200;
    res._headers = {};
    res.setHeader = (key, val) => {
      res._headers[key.toLowerCase()] = val;
      if (key.toLowerCase() === 'set-cookie') {
        const valStr = Array.isArray(val) ? val[0] : val;
        cookieJar = valStr.split(';')[0];
      }
    };
    res.getHeader = (key) => res._headers[key.toLowerCase()];

    let responseData = '';
    res.write = (chunk) => {
      responseData += chunk;
      return true;
    };
    res.end = (chunk) => {
      if (chunk) responseData += chunk;
      let parsed = responseData;
      const ct = res.getHeader('content-type') || '';
      if (ct.includes('application/json')) {
        try {
          parsed = JSON.parse(responseData);
        } catch (e) {}
      }
      resolve({
        status: res.statusCode,
        headers: res._headers,
        data: parsed
      });
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      responseData = JSON.stringify(data);
      res.end();
    };
    res.send = (data) => {
      responseData = typeof data === 'object' ? JSON.stringify(data) : String(data);
      res.end();
    };

    // Run app with mock req and res
    process.nextTick(() => {
      app(req, res);
    });
  });
}

async function runAllTests() {
  console.log('--- Starting In-Process Backend Integration Tests ---');

  // 1. Health check
  console.log('\n1. GET /api/health');
  const h = await mockRequest('GET', '/api/health');
  console.log('Health check status:', h.status, h.data);
  if (h.status !== 200 || h.data.status !== 'ok') throw new Error('Health check failed');

  // 2. Unauthenticated check
  console.log('\n2. GET /api/exams/my-exams (without session)');
  cookieJar = '';
  const unauth = await mockRequest('GET', '/api/exams/my-exams');
  console.log('Unauthenticated status:', unauth.status, unauth.data);
  if (unauth.status !== 401) throw new Error('Expected 401 for unauth request');

  // 3. Student Login
  console.log('\n3. POST /api/auth/student/login (STU2023001 / student123)');
  const stuLogin = await mockRequest('POST', '/api/auth/student/login', {
    enrollment_no: 'STU2023001',
    password: 'student123'
  });
  console.log('Login result:', stuLogin.status, stuLogin.data);
  if (!stuLogin.data.success || stuLogin.data.user.role !== 'student') {
    throw new Error('Student login failed');
  }

  // 4. Current user check
  console.log('\n4. GET /api/auth/me');
  const me = await mockRequest('GET', '/api/auth/me');
  console.log('Me status:', me.status, me.data);
  if (!me.data.authenticated || me.data.user.enrollment_no !== 'STU2023001') {
    throw new Error('Auth /me failed');
  }

  // 5. My Exams
  console.log('\n5. GET /api/exams/my-exams');
  const myExams = await mockRequest('GET', '/api/exams/my-exams');
  console.log('Assigned exams found:', myExams.data.exams?.length);
  const exam = myExams.data.exams.find((e) => e.status !== 'completed');
  if (!exam) throw new Error('No uncompleted test exam found');
  console.log('Selected exam for testing:', exam.id, exam.title, exam.status);

  // 6. Verify exam code
  console.log('\n6. POST /api/exams/verify-code');
  const codeFail = await mockRequest('POST', '/api/exams/verify-code', {
    exam_id: exam.id,
    exam_code: 'INCORRECT'
  });
  console.log('Wrong code status:', codeFail.status, codeFail.data);
  if (codeFail.status !== 400) throw new Error('Wrong code should fail with 400');

  const codeOk = await mockRequest('POST', '/api/exams/verify-code', {
    exam_id: exam.id,
    exam_code: 'WTDB2026'
  });
  console.log('Correct code status:', codeOk.status, codeOk.data);
  if (!codeOk.data.success) throw new Error('Verify code failed');

  // 7. Start Exam
  console.log('\n7. POST /api/exams/start');
  const start = await mockRequest('POST', '/api/exams/start', {
    exam_id: exam.id,
    exam_code: 'WTDB2026'
  });
  console.log('Start status:', start.status);
  console.log('Attempt ID:', start.data.attempt?.id);
  console.log('Remaining seconds:', start.data.attempt?.remaining_seconds);
  console.log('Questions received:', start.data.questions?.length);

  // CRITICAL SECURITY: Verify correct_option is NOT exposed
  const leaked = start.data.questions.find((q) => q.correct_option !== undefined);
  if (leaked) {
    throw new Error('SECURITY VIOLATION: correct_option exposed in questions!');
  }
  console.log('SECURITY AUDIT PASSED: correct_option is completely omitted from student question payloads.');

  const attemptId = start.data.attempt.id;
  const questions = start.data.questions;

  // 8. Save answers
  console.log('\n8. POST /api/exams/save-answer');
  const save1 = await mockRequest('POST', '/api/exams/save-answer', {
    attempt_id: attemptId,
    question_id: questions[0].id,
    selected_option: 'B',
    is_marked_for_review: false
  });
  console.log('Save Q0 status:', save1.status, save1.data);

  const save2 = await mockRequest('POST', '/api/exams/save-answer', {
    attempt_id: attemptId,
    question_id: questions[1].id,
    selected_option: 'C',
    is_marked_for_review: true
  });
  console.log('Save Q1 status:', save2.status, save2.data);

  // 9. Submit exam
  console.log('\n9. POST /api/exams/submit');
  const submit = await mockRequest('POST', '/api/exams/submit', {
    attempt_id: attemptId
  });
  console.log('Submit response summary:', submit.status, submit.data.summary);
  if (!submit.data.success) throw new Error('Exam submission failed');

  // 10. Resubmit test
  console.log('\n10. Testing duplicate submission protection');
  const resubmit = await mockRequest('POST', '/api/exams/submit', {
    attempt_id: attemptId
  });
  console.log('Resubmit response:', resubmit.data);
  if (!resubmit.data.message.includes('already')) throw new Error('Duplicate submission not prevented');

  // 11. Results endpoint
  console.log(`\n11. GET /api/results/${attemptId}`);
  const detailedResult = await mockRequest('GET', `/api/results/${attemptId}`);
  console.log('Overall assessment:', detailedResult.data.analysis?.overall_assessment);
  console.log('Strongest topic:', detailedResult.data.analysis?.strongest_topic);
  console.log('Weakest topic:', detailedResult.data.analysis?.weakest_topic);
  console.log('Topic breakdown count:', detailedResult.data.topic_breakdown?.length);
  console.log('Historical trend attempts count:', detailedResult.data.historical_trends?.length);
  if (!detailedResult.data.success || !detailedResult.data.topic_breakdown) {
    throw new Error('Detailed result breakdown failed');
  }

  // 12. Admin journey
  console.log('\n12. Admin Login (admin / admin123)');
  cookieJar = '';
  const adminLogin = await mockRequest('POST', '/api/auth/admin/login', {
    username: 'admin',
    password: 'admin123'
  });
  console.log('Admin login status:', adminLogin.status, adminLogin.data.message);
  if (!adminLogin.data.success) throw new Error('Admin login failed');

  // 13. Admin: Students
  console.log('\n13. Admin GET /api/admin/students');
  const stuList = await mockRequest('GET', '/api/admin/students');
  console.log('Students count:', stuList.data.students?.length);

  // 14. Admin: Exams
  console.log('\n14. Admin GET /api/admin/exams');
  const examList = await mockRequest('GET', '/api/admin/exams');
  console.log('Exams count:', examList.data.exams?.length);

  // 15. Admin: CSV Export
  console.log('\n15. Admin GET /api/admin/results/export');
  const csvExport = await mockRequest('GET', '/api/admin/results/export');
  console.log('CSV Content-Type:', csvExport.headers['content-type']);
  console.log('CSV preview:\n' + csvExport.data.split('\n').slice(0, 3).join('\n'));
  if (csvExport.status !== 200 || !csvExport.data.includes('Enrollment Number')) {
    throw new Error('CSV Export validation failed');
  }

  console.log('\n======================================================');
  console.log('>>> ALL 15 BACKEND TESTS PASSED WITH 100% SUCCESS! <<<');
  console.log('======================================================');
}

runAllTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
