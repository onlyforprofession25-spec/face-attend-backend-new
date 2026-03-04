const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser } = require('../controllers/admin.controller');
const {
    saveTimetable,
    getAllTimetables,
    getTimetableByClass,
    deleteTimetable
} = require('../controllers/timetable.controller');
const { protect, admin } = require('../middleware/auth.middleware');

// Protect all routes
router.use(protect);

// Shared Routes (Viewing)
router.get('/timetable/:className/:section', getTimetableByClass);

// Admin Only Routes (Management)
router.use(admin);

// User Management
router.get('/students', getAllUsers);
router.delete('/users/:id', deleteUser);

// Timetable Management
router.get('/timetable', getAllTimetables);
router.post('/timetable', saveTimetable);
router.delete('/timetable/:id', deleteTimetable);

module.exports = router;
