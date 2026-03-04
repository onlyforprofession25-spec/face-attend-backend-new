const mongoose = require('mongoose');

const discussionMessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    className: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: false // Optional if image is provided
    },
    image: {
        type: String, // Base64 or URL
        required: false
    },
    type: {
        type: String,
        enum: ['text', 'image', 'system'],
        default: 'text'
    }
}, {
    timestamps: true
});

// Index for fast retrieval of class/section discussions
discussionMessageSchema.index({ className: 1, section: 1, createdAt: -1 });

module.exports = mongoose.model('DiscussionMessage', discussionMessageSchema);
