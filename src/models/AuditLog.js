const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'attendance_marked',
            'session_started',
            'session_ended',
            'fraud_attempt',
            'manual_approval',
            'face_registered',
            'duplicate_face_blocked',
            'liveness_failed',
            'phone_detected'
        ]
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceSession',
        default: null
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },
    deviceIP: {
        type: String,
        default: 'unknown'
    },
    userAgent: {
        type: String,
        default: 'unknown'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    timestamps: true
});

// Indexes for audit queries
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
