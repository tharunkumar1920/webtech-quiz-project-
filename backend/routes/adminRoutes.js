const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/authMiddleware');

// All admin routes require admin authorization
router.use(requireAdmin);

// Student management
router.get('/students', adminController.getAllStudents);
router.post('/students', adminController.createStudent);
router.put('/students/:id', adminController.updateStudent);

// Exam management
router.get('/exams', adminController.getAllExams);
router.post('/exams', adminController.createExam);
router.post('/exams-with-questions', adminController.createExamWithQuestions);
router.put('/exams/:id', adminController.updateExam);
router.put('/exams/:id/toggle', adminController.toggleExamStatus);
router.post('/exams/:id/assign', adminController.assignExamToStudents);
router.get('/exams/:id/assignments', adminController.getExamAssignments);

// Question management
router.get('/exams/:examId/questions', adminController.getQuestionsByExam);
router.post('/questions', adminController.createQuestion);
router.put('/questions/:id', adminController.updateQuestion);
router.delete('/questions/:id', adminController.deleteQuestion);

// Results & Export
router.get('/results', adminController.getAllResults);
router.get('/results/export', adminController.exportResultsCSV);

// Instructor & Staff management
router.get('/instructors', adminController.getAllInstructors);
router.post('/instructors', adminController.createInstructor);
router.delete('/instructors/:id', adminController.deleteInstructor);

module.exports = router;
