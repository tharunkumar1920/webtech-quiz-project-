const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Student registration (Sign Up)
router.post('/student/register', authController.studentRegister);

// Student login (Sign In)
router.post('/student/login', authController.studentLogin);

// Admin login
router.post('/admin/login', authController.adminLogin);

// Current session user
router.get('/me', authController.getCurrentUser);

// Logout
router.post('/logout', authController.logout);

module.exports = router;
