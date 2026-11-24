const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { requireStudent, requireAuth } = require('../middleware/authMiddleware');

// Student historical results
router.get('/my-results', requireStudent, resultController.getMyResults);

// Specific attempt result details (for student or admin)
router.get('/:attemptId', requireAuth, resultController.getResultByAttemptId);

module.exports = router;
