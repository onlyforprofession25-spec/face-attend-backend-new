const express = require('express');
const router = express.Router();
const {
    startSession,
    stopSession,
    getActiveSession,
    markAttendance,
    markAttendanceMultiple,
    approveAttendance,
    getSessionRecords,
    getStudentsByClass,
    getAllStudents,
    getFacultyTimetable,
    resetLivenessSession,
    getAllSessions
} = require('../controllers/faculty.controller');
const { protect, facultyOnly } = require('../middleware/auth.middleware');

// Timetable
router.get('/timetable', protect, facultyOnly, getFacultyTimetable);

// Session management
router.post('/start-session', protect, facultyOnly, startSession);
router.post('/stop-session', protect, facultyOnly, stopSession);
router.get('/active-session', protect, facultyOnly, getActiveSession);

// Attendance marking
router.post('/mark-attendance', protect, facultyOnly, markAttendance);
router.post('/mark-attendance-multiple', protect, facultyOnly, markAttendanceMultiple);
router.post('/reset-liveness', protect, facultyOnly, resetLivenessSession);

// Manual approval
router.put('/approve-attendance/:recordId', protect, facultyOnly, approveAttendance);

// Session records
router.get('/session-records/:sessionId', protect, facultyOnly, getSessionRecords);
router.get('/sessions', protect, facultyOnly, getAllSessions);

// Get students by class
router.get('/students', protect, facultyOnly, getStudentsByClass);

// Get ALL students
router.get('/all-students', protect, facultyOnly, getAllStudents);

module.exports = router;
