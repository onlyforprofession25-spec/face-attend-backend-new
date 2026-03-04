const PersonalDiary = require('../models/PersonalDiary');

// @desc    Get all personal journal entries for the current user
// @route   GET /api/personal-diary
// @access  Private
const getMyJournal = async (req, res) => {
    try {
        const entries = await PersonalDiary.find({ userId: req.user._id })
            .sort({ date: -1 });
        res.status(200).json({ entries });
    } catch (error) {
        console.error('Get journal error:', error);
        res.status(500).json({ message: 'Failed to fetch journal entries' });
    }
};

// @desc    Create a new journal entry
// @route   POST /api/personal-diary
// @access  Private
const createJournalEntry = async (req, res) => {
    try {
        const { title, content, mood, date } = req.body;
        const entry = await PersonalDiary.create({
            userId: req.user._id,
            title,
            content,
            mood,
            date: date || Date.now()
        });
        res.status(201).json({ message: 'Journal entry saved', entry });
    } catch (error) {
        console.error('Create journal entry error:', error);
        res.status(500).json({ message: 'Failed to save entry' });
    }
};

// @desc    Delete a journal entry
// @route   DELETE /api/personal-diary/:id
// @access  Private
const deleteJournalEntry = async (req, res) => {
    try {
        const entry = await PersonalDiary.findOne({ _id: req.params.id, userId: req.user._id });
        if (!entry) return res.status(404).json({ message: 'Entry not found' });

        await PersonalDiary.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Entry deleted successfully' });
    } catch (error) {
        console.error('Delete journal entry error:', error);
        res.status(500).json({ message: 'Failed to delete entry' });
    }
};

module.exports = {
    getMyJournal,
    createJournalEntry,
    deleteJournalEntry
};
