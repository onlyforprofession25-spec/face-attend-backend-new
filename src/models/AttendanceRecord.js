const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    facultyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceSession',
        required: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    confidenceScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    livenessScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    matchStatus: {
        type: String,
        enum: ['confirmed', 'weak', 'rejected', 'manual_review', 'failed', 'verifying'],
        required: true
    },
    livenessStatus: {
        type: String,
        enum: ['real', 'suspicious', 'not_checked', 'verified'],
        default: 'not_checked'
    },
    phoneDetected: {
        type: Boolean,
        default: false
    },
    deviceIP: {
        type: String,
        default: 'unknown'
    },
    capturedImageSnapshot: {
        type: String,
        default: null
    },
    manuallyApproved: {
        type: Boolean,
        default: false
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
attendanceRecordSchema.index({ sessionId: 1, studentId: 1 });
attendanceRecordSchema.index({ facultyId: 1, timestamp: -1 });
attendanceRecordSchema.index({ matchStatus: 1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
