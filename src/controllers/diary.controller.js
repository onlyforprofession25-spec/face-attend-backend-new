const Diary = require('../models/Diary');
const User = require('../models/User');

// @desc    Get diary entries for a student (based on their class/section)
// @route   GET /api/diary/student
// @access  Private (Student)
const getStudentDiary = async (req, res) => {
    try {
        const { className, section } = req.user;

        if (!className || !section) {
            return res.status(400).json({ message: 'Student profile incomplete (Missing Class/Section)' });
        }

        const entries = await Diary.find({
            className: className,
            section: section
        })
            .populate('facultyId', 'fullName')
            .sort({ date: -1 });

        res.status(200).json({ entries });
    } catch (error) {
        console.error('Get student diary error:', error);
        res.status(500).json({ message: 'Failed to fetch diary entries' });
    }
};

// @desc    Get diary entries created by a faculty
// @route   GET /api/diary/faculty
// @access  Private (Faculty)
const getFacultyDiary = async (req, res) => {
    try {
        const facultyId = req.user._id;
        const entries = await Diary.find({ facultyId })
            .sort({ date: -1 });

        res.status(200).json({ entries });
    } catch (error) {
        console.error('Get faculty diary error:', error);
        res.status(500).json({ message: 'Failed to fetch diary entries' });
    }
};

// @desc    Create a new diary entry (Homework)
// @route   POST /api/diary
// @access  Private (Faculty)
const createDiaryEntry = async (req, res) => {
    try {
        const { subject, homework, className, section, date } = req.body;
        const facultyId = req.user._id;

        if (!subject || !homework || !className || !section) {
            return res.status(400).json({ message: 'Subject, Homework, Class, and Section are required' });
        }

        const diary = await Diary.create({
            facultyId,
            subject,
            homework,
            className,
            section,
            date: date || Date.now()
        });

        res.status(201).json({
            message: 'Diary entry created successfully',
            diary
        });
    } catch (error) {
        console.error('Create diary entry error:', error);
        res.status(500).json({ message: 'Failed to create diary entry' });
    }
};

// @desc    Delete a diary entry
// @route   DELETE /api/diary/:id
// @access  Private (Faculty)
const deleteDiaryEntry = async (req, res) => {
    try {
        const diary = await Diary.findById(req.params.id);

        if (!diary) {
            return res.status(404).json({ message: 'Diary entry not found' });
        }

        // Verify ownership
        if (diary.facultyId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await Diary.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Diary entry deleted successfully' });
    } catch (error) {
        console.error('Delete diary entry error:', error);
        res.status(500).json({ message: 'Failed to delete diary entry' });
    }
};

module.exports = {
    getStudentDiary,
    getFacultyDiary,
    createDiaryEntry,
    deleteDiaryEntry
};
