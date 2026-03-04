const mongoose = require('mongoose');

const personalDiarySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        trim: true,
        default: ""
    },
    content: {
        type: String,
        required: true
    },
    mood: {
        type: String,
        enum: ['Happy', 'Focused', 'Tired', 'Inspired', 'Neutral', 'Stressed'],
        default: 'Neutral'
    },
    date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PersonalDiary', personalDiarySchema);
