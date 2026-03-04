const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getUserProfile,
    updateFaceStatus,
    registerFace,
    checkFaceQuality,
    takeAttendanceVerify,
    takeAttendanceMultiple,
    getDashboardStats,
    getStudentDashboardData,
    forgotPassword,
    resetPassword,
    updateUserProfile,
    getDetailedAnalytics,
    deleteSelf,
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password', resetPassword);
router.get('/me', protect, getUserProfile);
router.get('/stats', protect, getDashboardStats);
router.get('/student-dashboard', protect, getStudentDashboardData);
router.get('/analytics', protect, getDetailedAnalytics);
router.put('/profile', protect, updateUserProfile);
router.put('/face-status', protect, updateFaceStatus);
router.post('/register-face', protect, registerFace);
router.post('/face-quality', protect, checkFaceQuality);
router.post('/take-attendance', protect, takeAttendanceVerify);
router.post('/take-attendance-multiple', protect, takeAttendanceMultiple);
router.delete('/delete-self', protect, deleteSelf);

module.exports = router;
