const express = require('express');
const router = express.Router();
const {
    getStudentDiary,
    getFacultyDiary,
    createDiaryEntry,
    deleteDiaryEntry
} = require('../controllers/diary.controller');
const { protect, facultyOnly, studentOnly } = require('../middleware/auth.middleware');

// Student access
router.get('/student', protect, studentOnly, getStudentDiary);

// Faculty access
router.get('/faculty', protect, facultyOnly, getFacultyDiary);
router.post('/', protect, facultyOnly, createDiaryEntry);
router.delete('/:id', protect, facultyOnly, deleteDiaryEntry);

module.exports = router;
