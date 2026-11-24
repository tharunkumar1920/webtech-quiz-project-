const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { requireStudent } = require('../middleware/authMiddleware');

// All student exam endpoints require student auth
router.use(requireStudent);

router.get('/my-exams', examController.getMyExams);
router.post('/verify-code', examController.verifyExamCode);
router.post('/start', examController.startExam);
router.post('/save-answer', examController.saveAnswer);
router.post('/submit', examController.submitExam);

module.exports = router;
