const express = require('express');
const router = express.Router();
const { createEvent, getAllEvents, deleteEvent } = require('../controllers/event.controller');
const { protect, facultyOnly } = require('../middleware/auth.middleware');

router.get('/', protect, getAllEvents);
router.post('/', protect, facultyOnly, createEvent);
router.delete('/:id', protect, facultyOnly, deleteEvent);

module.exports = router;
