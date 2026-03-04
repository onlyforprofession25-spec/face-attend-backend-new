const mongoose = require('mongoose');

const diarySchema = new mongoose.Schema({
    facultyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    homework: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    className: {
        type: String,
        required: true,
        trim: true
    },
    section: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Diary', diarySchema);
