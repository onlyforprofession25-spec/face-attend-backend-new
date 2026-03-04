const mongoose = require('mongoose');

const periodSchema = mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['period', 'lunch', 'snack'],
        default: 'period'
    },
    startTime: {
        type: String, // format: "HH:mm"
        required: true
    },
    endTime: {
        type: String, // format: "HH:mm"
        required: true
    },
    facultyName: {
        type: String
    }
});

const dayScheduleSchema = mongoose.Schema({
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
    },
    periods: [periodSchema]
});

const timetableSchema = mongoose.Schema({
    className: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    schoolStartTime: {
        type: String,
        default: "08:00"
    },
    schoolEndTime: {
        type: String,
        default: "14:30"
    },
    schedule: [dayScheduleSchema]
}, {
    timestamps: true
});

// Ensure a class/section combination is unique
timetableSchema.index({ className: 1, section: 1 }, { unique: true });

const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable;
