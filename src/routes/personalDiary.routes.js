const express = require('express');
const router = express.Router();
const { getMyJournal, createJournalEntry, deleteJournalEntry } = require('../controllers/personalDiary.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect); // All routes are protected

router.get('/', getMyJournal);
router.post('/', createJournalEntry);
router.delete('/:id', deleteJournalEntry);

module.exports = router;
