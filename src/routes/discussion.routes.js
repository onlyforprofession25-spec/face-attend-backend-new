const express = require('express');
const router = express.Router();
const {
    getMessages,
    sendMessage,
    getGroupMembers,
    editMessage,
    deleteMessage,
    clearChat
} = require('../controllers/discussion.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.get('/members', getGroupMembers);
router.put('/messages/:id', editMessage);
router.delete('/messages/:id', deleteMessage);
router.delete('/clear', clearChat);

module.exports = router;
