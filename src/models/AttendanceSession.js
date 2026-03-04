const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        default: () => `SESSION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },
    facultyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    classId: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    subjectId: {
        type: String,
        required: true
    },
    subjectName: {
        type: String,
        required: true
    },
    startTime: {
        type: Date,
        required: true,
        default: Date.now
    },
    endTime: {
        type: Date,
        default: null
    },
    active: {
        type: Boolean,
        default: true
    },
    totalPresent: {
        type: Number,
        default: 0
    },
    totalAbsent: {
        type: Number,
        default: 0
    },
    attendanceRecords: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceRecord'
    }]
}, {
    timestamps: true
});

// Index for faster queries
attendanceSessionSchema.index({ facultyId: 1, active: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
