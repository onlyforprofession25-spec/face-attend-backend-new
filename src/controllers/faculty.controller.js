const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const axios = require('axios');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper function to log audit events
async function logAudit(action, userId, performedBy, sessionId, details, severity = 'info', req) {
    try {
        await AuditLog.create({
            action,
            userId,
            performedBy,
            sessionId,
            details,
            severity,
            deviceIP: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('user-agent') || 'unknown'
        });
    } catch (err) {
        console.error('Audit log error:', err);
    }
}

// Helper to determine active faculty context (Proxy Support)
async function getFacultyContext(req) {
    let facultyId = req.user._id;
    // Check various sources for proxy email
    const proxyEmail = req.headers['x-proxy-faculty'] || req.query.proxyEmail || req.body.proxyEmail;

    if (proxyEmail) {
        const target = await User.findOne({ email: proxyEmail, role: 'faculty' });
        if (target) {
            facultyId = target._id;
        }
    }
    return facultyId;
}

// @desc    Start attendance session
// @route   POST /api/faculty/start-session
// @access  Private (Faculty only)
const startSession = async (req, res) => {
    try {
        const { classId, section, subjectId, subjectName } = req.body;
        const facultyId = await getFacultyContext(req);

        // Validate required fields
        if (!classId || !section || !subjectId || !subjectName) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if faculty already has an active session
        const existingSession = await AttendanceSession.findOne({
            facultyId,
            active: true
        });

        if (existingSession) {
            return res.status(400).json({
                message: 'You already have an active session. Please end it before starting a new one.',
                existingSession: {
                    sessionId: existingSession.sessionId,
                    subject: existingSession.subjectName,
                    startTime: existingSession.startTime
                }
            });
        }

        // Create new session
        const session = await AttendanceSession.create({
            facultyId,
            classId,
            section,
            subjectId,
            subjectName
        });

        // Log audit
        await logAudit(
            'session_started',
            facultyId,
            facultyId,
            session._id,
            { classId, section, subjectId, subjectName },
            'info',
            req
        );

        // Build/update FAISS index with current students
        try {
            const students = await User.find({
                role: 'student',
                faceRegistered: true,
                faceEmbedding: { $exists: true, $ne: null }
            });

            if (students.length > 0) {
                const embeddings = students.map(s => ({
                    id: s._id.toString(),
                    embedding: s.faceEmbedding
                }));

                await axios.post(`${process.env.AI_SERVICE_URL}/build-faiss-index`, {
                    embeddings
                });

                console.log(`✅ FAISS index built with ${students.length} students`);
            }
        } catch (faissError) {
            console.warn('FAISS index build failed:', faissError.message);
            // Continue anyway - will fallback to manual matching
        }

        res.status(201).json({
            message: 'Attendance session started successfully',
            session: {
                sessionId: session.sessionId,
                _id: session._id,
                classId: session.classId,
                section: session.section,
                subjectName: session.subjectName,
                startTime: session.startTime,
                active: session.active
            }
        });

    } catch (error) {
        console.error('Start session error:', error);
        res.status(500).json({ message: 'Failed to start session' });
    }
};

// @desc    Stop attendance session
// @route   POST /api/faculty/stop-session
// @access  Private (Faculty only)
const stopSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const facultyId = await getFacultyContext(req);

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        const session = await AttendanceSession.findOne({
            _id: sessionId,
            facultyId,
            active: true
        });

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        // Update session
        session.endTime = new Date();
        session.active = false;
        await session.save();

        // Calculate statistics
        const totalPresent = await AttendanceRecord.countDocuments({
            sessionId: session._id,
            matchStatus: { $in: ['confirmed', 'weak'] }
        });

        const totalStudents = await User.countDocuments({
            role: 'student',
            className: session.classId,
            section: session.section
        });

        session.totalPresent = totalPresent;
        session.totalAbsent = totalStudents - totalPresent;
        await session.save();

        // Log audit
        await logAudit(
            'session_ended',
            facultyId,
            facultyId,
            session._id,
            { totalPresent, totalAbsent: session.totalAbsent, duration: session.endTime - session.startTime },
            'info',
            req
        );

        res.status(200).json({
            message: 'Session ended successfully',
            session: {
                sessionId: session.sessionId,
                startTime: session.startTime,
                endTime: session.endTime,
                totalPresent,
                totalAbsent: session.totalAbsent,
                duration: Math.round((session.endTime - session.startTime) / 1000 / 60) // minutes
            }
        });

    } catch (error) {
        console.error('Stop session error:', error);
        res.status(500).json({ message: 'Failed to stop session' });
    }
};

// @desc    Get active session
// @route   GET /api/faculty/active-session
// @access  Private (Faculty only)
const getActiveSession = async (req, res) => {
    try {
        const facultyId = await getFacultyContext(req);

        const session = await AttendanceSession.findOne({
            facultyId,
            active: true
        }).populate({
            path: 'attendanceRecords',
            populate: {
                path: 'studentId',
                select: 'fullName rollNumber className section faceRegistered'
            }
        });

        if (!session) {
            return res.status(404).json({ message: 'No active session found' });
        }

        const presentCount = await AttendanceRecord.countDocuments({
            sessionId: session._id,
            matchStatus: { $in: ['confirmed', 'weak'] }
        });

        res.status(200).json({
            session: {
                sessionId: session.sessionId,
                _id: session._id,
                classId: session.classId,
                section: session.section,
                subjectName: session.subjectName,
                startTime: session.startTime,
                active: session.active,
                presentCount,
                attendanceRecords: session.attendanceRecords
            }
        });

    } catch (error) {
        console.error('Get active session error:', error);
        res.status(500).json({ message: 'Failed to fetch active session' });
    }
};

// @desc    Mark attendance (Enhanced with session validation)
// @route   POST /api/faculty/mark-attendance
// @access  Private (Faculty only)
const markAttendance = async (req, res) => {
    try {
        const { sessionId, image } = req.body;
        const facultyId = await getFacultyContext(req);

        // Validate session
        const session = await AttendanceSession.findOne({
            _id: sessionId,
            facultyId,
            active: true
        });

        if (!session) {
            return res.status(400).json({ message: 'No active session found. Please start a session first.' });
        }

        // Call AI service for verification
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/verify-face`, {
            image
        });

        const { match, studentId, matchConfidence, status, livenessScore, livenessStatus, phoneDetected, boundingBox } = aiResponse.data;

        // Check for fraud
        if (phoneDetected) {
            await logAudit(
                'fraud_attempt',
                studentId || 'unknown',
                facultyId,
                session._id,
                { reason: 'phone_detected', confidence: matchConfidence },
                'critical',
                req
            );

            return res.status(400).json({
                match: false,
                message: 'Phone detected in frame - potential fraud attempt',
                phoneDetected: true,
                boundingBox
            });
        }

        if (livenessStatus === 'suspicious') {
            await logAudit(
                'liveness_failed',
                studentId || 'unknown',
                facultyId,
                session._id,
                { livenessScore, confidence: matchConfidence },
                'warning',
                req
            );
        }

        if (status === 'rejected' || !match) {
            return res.status(200).json({
                match: false,
                status: 'unknown',
                message: aiResponse.data.message || 'No student recognized',
                boundingBox
            });
        }

        // Check if already marked
        const existingRecord = await AttendanceRecord.findOne({
            sessionId: session._id,
            studentId
        });

        if (existingRecord) {
            const student = await User.findById(studentId).select('fullName className section rollNumber');
            return res.status(200).json({
                match: true,
                status: 'already_marked',
                message: 'Student already marked present in this session',
                student,
                alreadyMarked: true,
                boundingBox
            });
        }

        // Fetch student details
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Create attendance record
        const attendanceRecord = await AttendanceRecord.create({
            studentId,
            facultyId,
            sessionId: session._id,
            confidenceScore: matchConfidence,
            livenessScore,
            matchStatus: status,
            livenessStatus,
            phoneDetected,
            deviceIP: req.ip || req.connection.remoteAddress || 'unknown',
            manuallyApproved: status === 'weak' ? false : true // Weak matches need manual approval
        });

        // Add to session
        session.attendanceRecords.push(attendanceRecord._id);
        await session.save();

        // Log audit
        await logAudit(
            'attendance_marked',
            studentId,
            facultyId,
            session._id,
            {
                studentName: student.fullName,
                confidence: matchConfidence,
                status,
                livenessScore
            },
            status === 'weak' ? 'warning' : 'info',
            req
        );

        res.status(200).json({
            match: true,
            message: status === 'confirmed' ? 'Attendance marked successfully' : 'Weak match - requires manual approval',
            student: {
                fullName: student.fullName,
                className: student.className,
                section: student.section,
                rollNumber: student.rollNumber || 'N/A',
                id: student._id
            },
            matchConfidence,
            status,
            livenessScore,
            needsApproval: status === 'weak'
        });

    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ message: 'Attendance marking failed' });
    }
};

// @desc    Mark attendance for multiple faces
// @route   POST /api/faculty/mark-attendance-multiple
// @access  Private (Faculty only)
const markAttendanceMultiple = async (req, res) => {
    try {
        const { sessionId, image } = req.body;
        const facultyId = await getFacultyContext(req);

        // Validate session
        const session = await AttendanceSession.findOne({
            _id: sessionId,
            facultyId,
            active: true
        });

        if (!session) {
            return res.status(400).json({ message: 'No active session found. Please start a session first.' });
        }

        console.log(`🔍 Strict Multi-Face Scan for session: ${session.sessionId}`);

        // Call AI service
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/verify-multiple-faces`, {
            image
        });

        const { matches, totalDetected, phoneDetected, spoofDetected, message } = aiResponse.data;

        if (phoneDetected || spoofDetected) {
            await logAudit(
                'fraud_attempt',
                facultyId, // use facultyId instead of string
                facultyId,
                session._id,
                {
                    reason: spoofDetected ? 'spoof_detected' : 'phone_detected',
                    totalDetected
                },
                'critical',
                req
            );

            return res.status(403).json({
                spoofDetected: true,
                message: message || 'Spoof attempt detected. Scanning stopped.',
                totalDetected
            });
        }



        const markedStudents = [];
        const alreadyMarked = [];
        const needsApproval = [];
        const suspiciousAttempts = [];

        // Pre-fetch all student IDs already marked present


        // Process matches
        await Promise.all(matches.map(async (match) => {
            const { studentId, matchConfidence, status, livenessStatus, livenessScore, boundingBox, livenessDetails } = match;
            console.log(`📡 [BACKEND RADAR] Match for ${studentId}: Status=${livenessStatus}, Confidence=${matchConfidence}%`);
            console.log(`🛡️ [BACKEND RADAR] Liveness Details:`, JSON.stringify(livenessDetails));

            // 1. Handle Unverified (verifying or failed) - pass back to frontend for guidance
            if (livenessStatus !== 'verified') {
                let name = "Verifying...";
                const student = await User.findById(studentId).select('fullName rollNumber className section');
                if (student) {
                    name = student.fullName;
                    markedStudents.push({
                        studentId,
                        id: studentId,
                        fullName: name,
                        rollNumber: student.rollNumber,
                        className: student.className,
                        section: student.section,
                        matchConfidence,
                        status: livenessStatus === 'verifying' ? 'weak' : 'rejected',
                        livenessStatus,
                        livenessDetails,
                        boundingBox
                    });
                    return;
                }

                markedStudents.push({
                    studentId,
                    id: studentId,
                    fullName: name,
                    matchConfidence, // Include this
                    status: livenessStatus === 'verifying' ? 'weak' : 'rejected',
                    livenessStatus,
                    livenessDetails,
                    boundingBox
                });
                return;
            }

            // 2. CHECK UNKNOWN
            if (!studentId || status === 'unknown') {
                console.log(`❓ RADAR: Unknown face detected (Confidence: ${matchConfidence}%)`);
                markedStudents.push({
                    fullName: "Unknown Student",
                    status: "unknown",
                    matchConfidence,
                    boundingBox,
                    livenessStatus: 'verified',
                    livenessDetails
                });
                return;
            }

            // 3. CHECK DUPLICATE

            // 3. CHECK DUPLICATE (DB-level safe check)
            if (status === 'already_marked') {
                console.log(`🔁 RADAR: Cache duplicate for ${studentId}`);
                const student = await User.findById(studentId).select('fullName rollNumber className section');
                if (student) {
                    markedStudents.push({
                        id: studentId,
                        fullName: student.fullName,
                        className: student.className,
                        section: student.section,
                        rollNumber: student.rollNumber,
                        status: "already_marked",
                        matchConfidence,
                        boundingBox,
                        livenessStatus: 'verified',
                        livenessDetails
                    });
                }
                return;
            }

            const existingRecord = await AttendanceRecord.findOne({
                sessionId: session._id,
                studentId: studentId
            });

            if (existingRecord) {
                console.log(`🔁 RADAR: Already exists in DB for ${studentId}`);

                const student = await User.findById(studentId).select('fullName rollNumber className section');

                markedStudents.push({
                    id: studentId,
                    fullName: student.fullName,
                    className: student.className,
                    section: student.section,
                    rollNumber: student.rollNumber,
                    status: "already_marked",
                    matchConfidence,
                    boundingBox,
                    livenessStatus: 'verified',
                    livenessDetails
                });

                return;
            }

            // 4. MARK ATTENDANCE (Verified & Identified)
            const student = await User.findById(studentId);
            if (!student) return;

            console.log(`📡 RADAR: Saving Attendance for ${studentId} (Match: ${matchConfidence}%)`);
            const attendanceRecord = await AttendanceRecord.create({
                studentId,
                facultyId,
                sessionId: session._id,
                confidenceScore: matchConfidence,
                livenessScore: livenessScore || 100,
                matchStatus: status,
                livenessStatus: 'verified',
                phoneDetected: false,
                deviceIP: req.ip || req.connection.remoteAddress || 'unknown',
                manuallyApproved: status === 'confirmed'
            });

            session.attendanceRecords.push(attendanceRecord._id);

            const studentData = {
                fullName: student.fullName,
                className: student.className,
                section: student.section,
                rollNumber: student.rollNumber || 'N/A',
                id: student._id,
                recordId: attendanceRecord._id,
                matchConfidence,
                status,
                livenessStatus: 'verified',
                livenessDetails,
                boundingBox
            };

            markedStudents.push(studentData);
            if (status === 'weak') needsApproval.push(studentData);

            logAudit('attendance_marked', studentId, facultyId, session._id, { studentName: student.fullName, confidence: matchConfidence, multiScan: true }, 'info', req).catch(() => { });
        }));

        await session.save();

        res.status(200).json({
            matches: markedStudents,
            totalMatched: markedStudents.filter(m => m.id && m.status !== 'already_marked').length,
            totalDetected,
            alreadyMarked,
            needsApproval,
            phoneDetected
        });
    } catch (error) {
        console.error('Multi-face attendance error:', error);
        res.status(500).json({ message: error.message || 'Multi-face attendance marking failed' });
    }
};

// @desc    Reset liveness session
// @route   POST /api/faculty/reset-liveness
// @access  Private (Faculty only)
const resetLivenessSession = async (req, res) => {
    try {
        await axios.post(`${process.env.AI_SERVICE_URL}/reset-liveness`);
        res.status(200).json({ message: "Liveness tracking recalibrated" });
    } catch (error) {
        res.status(500).json({ message: "Failed to reset AI liveness engine" });
    }
};

// @desc    Manually approve weak match
// @route   PUT /api/faculty/approve-attendance/:recordId
// @access  Private (Faculty only)
const approveAttendance = async (req, res) => {
    try {
        const { recordId } = req.params;
        const facultyId = req.user._id;

        const record = await AttendanceRecord.findById(recordId);

        if (!record) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        if (record.matchStatus !== 'weak') {
            return res.status(400).json({ message: 'Only weak matches can be manually approved' });
        }

        record.manuallyApproved = true;
        record.approvedBy = facultyId;
        record.matchStatus = 'confirmed';
        await record.save();

        await logAudit(
            'manual_approval',
            record.studentId,
            facultyId,
            record.sessionId,
            { recordId, originalConfidence: record.confidenceScore },
            'info',
            req
        );

        res.status(200).json({
            message: 'Attendance approved successfully',
            record
        });

    } catch (error) {
        console.error('Approve attendance error:', error);
        res.status(500).json({ message: 'Approval failed' });
    }
};

// @desc    Get session attendance records
// @route   GET /api/faculty/session-records/:sessionId
// @access  Private (Faculty only)
const getSessionRecords = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const facultyId = req.user._id;

        const session = await AttendanceSession.findOne({
            _id: sessionId,
            facultyId
        });

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const records = await AttendanceRecord.find({
            sessionId: session._id
        }).populate('studentId', 'fullName rollNumber className section');

        res.status(200).json({
            session: {
                sessionId: session.sessionId,
                subjectName: session.subjectName,
                startTime: session.startTime,
                endTime: session.endTime,
                active: session.active
            },
            records
        });

    } catch (error) {
        console.error('Get session records error:', error);
        res.status(500).json({ message: 'Failed to fetch records' });
    }
};

// @desc    Get all past sessions for faculty
// @route   GET /api/faculty/sessions
// @access  Private (Faculty only)
const getAllSessions = async (req, res) => {
    try {
        const facultyId = await getFacultyContext(req);
        const sessions = await AttendanceSession.find({ facultyId })
            .sort({ startTime: -1 });

        res.status(200).json({ sessions });
    } catch (error) {
        console.error('Get all sessions error:', error);
        res.status(500).json({ message: 'Failed to fetch sessions' });
    }
};

// @desc    Get all students for a class/section
// @route   GET /api/faculty/students
// @access  Private (Faculty only)
const getStudentsByClass = async (req, res) => {
    try {
        const { classId, section } = req.query;

        if (!classId || !section) {
            return res.status(400).json({ message: 'Class and Section are required' });
        }

        const students = await User.find({
            role: 'student',
            className: classId,
            section: section
        }).select('_id fullName rollNumber className section faceRegistered');

        res.status(200).json({ students });

    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
};

// @desc    Get ALL students
// @route   GET /api/faculty/students/all
// @access  Private (Faculty only)
const getAllStudents = async (req, res) => {
    try {
        const students = await User.find({
            role: 'student'
        })
            .select('_id fullName rollNumber className section faceRegistered')
            .sort({ className: 1, section: 1, fullName: 1 });

        res.status(200).json({ students });

    } catch (error) {
        console.error('Get all students error:', error);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
};

// @desc    Get faculty specific timetable
// @route   GET /api/faculty/timetable
// @access  Private (Faculty only)
const getFacultyTimetable = async (req, res) => {
    try {
        let facultyId = req.user._id;
        const { facultyEmail } = req.query;

        // If a target faculty email is provided (Proxy Mode)
        if (facultyEmail) {
            const targetFaculty = await User.findOne({ email: facultyEmail, role: 'faculty' });
            if (!targetFaculty) {
                return res.status(404).json({ message: 'Target faculty not found' });
            }
            facultyId = targetFaculty._id;
        }

        const faculty = await User.findById(facultyId);
        if (!faculty || faculty.role !== 'faculty') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const assignedClasses = faculty.assignedClasses || [];

        // Helper to normalize strings for comparison
        const normalize = (s) => String(s || "").trim().toLowerCase();

        // Structure response grouped by day
        const facultySchedule = DAYS.map(day => ({ day, periods: [] }));

        if (assignedClasses.length === 0) {
            return res.status(200).json({ timetable: facultySchedule });
        }

        // Find all timetables
        // For performance, we could filter by class/section, but let's normalize everything
        const allTimetables = await Timetable.find();
        const facultyName = normalize(faculty.fullName);

        allTimetables.forEach(tt => {
            // Find which subjects this faculty teaches in THIS specific tt's class/section
            const matchingAssignments = assignedClasses.filter(ac =>
                normalize(ac.className) === normalize(tt.className) &&
                normalize(ac.section) === normalize(tt.section)
            );

            const subjectsTeached = matchingAssignments.map(ma => normalize(ma.subject));

            tt.schedule.forEach(daySched => {
                const dayIndex = facultySchedule.findIndex(fs => normalize(fs.day) === normalize(daySched.day));
                if (dayIndex !== -1) {
                    // Filter periods to include:
                    // 1. Periods with matching subject
                    // 2. Periods with matching faculty name
                    // 3. Periods with NO faculty name IF the teacher is assigned to this class/section
                    const filteredPeriods = daySched.periods
                        .filter(p =>
                            subjectsTeached.includes(normalize(p.subject)) ||
                            normalize(p.facultyName) === facultyName ||
                            (matchingAssignments.length > 0 && !p.facultyName)
                        )
                        .map(p => {
                            const pObj = p.toObject ? p.toObject() : p;
                            return {
                                ...pObj,
                                className: tt.className,
                                section: tt.section,
                                schoolStartTime: tt.schoolStartTime,
                                schoolEndTime: tt.schoolEndTime
                            };
                        });

                    facultySchedule[dayIndex].periods.push(...filteredPeriods);
                }
            });
        });

        // Sort periods by start time for each day
        facultySchedule.forEach(day => {
            day.periods.sort((a, b) => a.startTime.localeCompare(b.startTime));
        });

        res.status(200).json({ timetable: facultySchedule });
    } catch (error) {
        console.error('Get faculty timetable error:', error);
        res.status(500).json({ message: 'Failed to fetch timetable' });
    }
};

module.exports = {
    startSession,
    stopSession,
    getActiveSession,
    markAttendance,
    markAttendanceMultiple,
    approveAttendance,
    getSessionRecords,
    getStudentsByClass,
    getAllStudents,
    getFacultyTimetable,
    resetLivenessSession,
    getAllSessions
};
