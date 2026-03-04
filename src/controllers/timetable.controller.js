const Timetable = require('../models/Timetable');

// @desc    Create or Update Timetable
// @route   POST /api/admin/timetable
// @access  Admin
const saveTimetable = async (req, res) => {
    try {
        const { className, section, schoolStartTime, schoolEndTime, schedule } = req.body;

        // Validation
        if (!className || !section) {
            return res.status(400).json({ message: 'Class and Section are required' });
        }

        // Check if exists, then update or create
        let timetable = await Timetable.findOne({ className, section });

        if (timetable) {
            timetable.schoolStartTime = schoolStartTime || timetable.schoolStartTime;
            timetable.schoolEndTime = schoolEndTime || timetable.schoolEndTime;
            timetable.schedule = schedule || timetable.schedule;
            await timetable.save();
        } else {
            timetable = await Timetable.create({
                className,
                section,
                schoolStartTime,
                schoolEndTime,
                schedule
            });
        }

        res.status(200).json({
            message: 'Timetable saved successfully',
            timetable
        });
    } catch (error) {
        console.error("Timetable Save Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all timetables
// @route   GET /api/admin/timetable
// @access  Admin
const getAllTimetables = async (req, res) => {
    try {
        const timetables = await Timetable.find().sort({ className: 1, section: 1 });
        res.json(timetables);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get timetable by class and section
// @route   GET /api/admin/timetable/:className/:section
// @access  Admin/Faculty/Student
const getTimetableByClass = async (req, res) => {
    try {
        const { className, section } = req.params;
        const timetable = await Timetable.findOne({ className, section });

        if (!timetable) {
            return res.status(404).json({ message: 'Timetable not found for this class' });
        }

        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Timetable
// @route   DELETE /api/admin/timetable/:id
// @access  Admin
const deleteTimetable = async (req, res) => {
    try {
        const timetable = await Timetable.findByIdAndDelete(req.params.id);
        if (!timetable) {
            return res.status(404).json({ message: 'Timetable not found' });
        }
        res.json({ message: 'Timetable deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    saveTimetable,
    getAllTimetables,
    getTimetableByClass,
    deleteTimetable
};
