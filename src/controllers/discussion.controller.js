const DiscussionMessage = require('../models/DiscussionMessage');
const User = require('../models/User');

// @desc    Get all messages for a class circle
// @route   GET /api/discussion/messages
// @access  Private
exports.getMessages = async (req, res) => {
    try {
        const { className, section } = req.user;

        // If user is faculty, they might need to provide className/section in query
        const targetClass = req.query.className || className;
        const targetSection = req.query.section || section;

        if (!targetClass || !targetSection) {
            return res.status(400).json({ message: "Class and Section are required" });
        }

        const messages = await DiscussionMessage.find({
            className: targetClass,
            section: targetSection
        })
            .populate('sender', 'fullName role')
            .sort({ createdAt: 1 })
            .limit(100);

        res.status(200).json(messages);
    } catch (error) {
        console.error("Fetch Messages Error:", error.message);
        res.status(500).json({ message: "Error fetching discussion messages" });
    }
};

// @desc    Send a message to class circle
// @route   POST /api/discussion/messages
// @access  Private
exports.sendMessage = async (req, res) => {
    try {
        const { content, image, type } = req.body;
        const { className, section, _id } = req.user;

        // Faculty logic for sending to specific class
        const targetClass = req.body.className || className;
        const targetSection = req.body.section || section;

        const newMessage = await DiscussionMessage.create({
            sender: _id,
            className: targetClass,
            section: targetSection,
            content,
            image,
            type: type || (image ? 'image' : 'text')
        });

        const populatedMessage = await newMessage.populate('sender', 'fullName role');

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error("Send Message Error:", error.message);
        res.status(500).json({ message: "Error sending message" });
    }
};

// @desc    Get group members (Students + Assigned Faculties)
// @route   GET /api/discussion/members
// @access  Private
exports.getGroupMembers = async (req, res) => {
    try {
        const { className, section } = req.user;
        const targetClass = req.query.className || className;
        const targetSection = req.query.section || section;

        // 1. Fetch Students
        const students = await User.find({
            role: 'student',
            className: targetClass,
            section: targetSection
        }).select('fullName role');

        // 2. Fetch Faculties assigned to this class/section
        const faculties = await User.find({
            role: 'faculty',
            'assignedClasses': {
                $elemMatch: {
                    className: targetClass,
                    section: targetSection
                }
            }
        }).select('fullName role');

        res.status(200).json({
            students,
            faculties,
            totalMembers: students.length + faculties.length
        });
    } catch (error) {
        console.error("Fetch Members Error:", error.message);
        res.status(500).json({ message: "Error fetching group members" });
    }
};
// @desc    Edit a message
// @route   PUT /api/discussion/messages/:id
exports.editMessage = async (req, res) => {
    try {
        const message = await DiscussionMessage.findById(req.params.id);
        if (!message) return res.status(404).json({ message: "Message not found" });

        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        message.content = req.body.content || message.content;
        message.isEdited = true;
        await message.save();

        res.status(200).json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a message
// @route   DELETE /api/discussion/messages/:id
exports.deleteMessage = async (req, res) => {
    try {
        const message = await DiscussionMessage.findById(req.params.id);
        if (!message) return res.status(404).json({ message: "Message not found" });

        // Authorization: Sender or Admin can delete
        if (message.sender.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Unauthorized" });
        }

        await DiscussionMessage.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Message removed" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Clear all messages for a class circle
// @route   DELETE /api/discussion/clear
exports.clearChat = async (req, res) => {
    try {
        const { className, section } = req.user;
        await DiscussionMessage.deleteMany({ className, section });
        res.status(200).json({ message: "Chat history cleared" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
