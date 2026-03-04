const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendLoginNotification, sendPasswordResetEmail } = require('../utils/emailService');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AuditLog = require('../models/AuditLog');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Timetable = require('../models/Timetable');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const {
            fullName, email, password, role,
            age, className, section,
            employeeId,
            subjects, assignedClasses,
            phoneNumber, parentPhoneNumber
        } = req.body;

        // Enforce password length (8 characters minimum as per request)
        if (!password || password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            fullName,
            email,
            password,
            role,
            age,
            className,
            section,
            employeeId,
            subjects,
            assignedClasses,
            phoneNumber,
            parentPhoneNumber
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                className: user.className,
                section: user.section,
                faceRegistered: user.faceRegistered,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Register Error:', error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        // Send login notification
        sendLoginNotification(user.email, user.fullName);

        res.json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            className: user.className,
            section: user.section,
            faceRegistered: user.faceRegistered,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: 'No user found with that email' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to field
    user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expire (10 mins)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    try {
        await sendPasswordResetEmail(user.email, resetToken);
        res.status(200).json({ message: 'Password reset link sent to your email' });
    } catch (err) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        res.status(500).json({ message: 'Email could not be sent' });
    }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    const { token, password } = req.body;

    if (!password || password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Get hashed token
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ message: 'Password reset successful!' });
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getUserProfile = async (req, res) => {
    const { email } = req.query;
    let userId = req.user._id;

    // Support proxy mode if an email is provided
    if (email) {
        const targetUser = await User.findOne({ email });
        if (targetUser) {
            userId = targetUser._id;
        }
    }

    const user = await User.findById(userId);

    if (user) {
        res.json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            subjects: user.subjects,
            assignedClasses: user.assignedClasses,
            className: user.className,
            section: user.section
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Update face registration status
// @route   PUT /api/auth/face-status
// @access  Private
const updateFaceStatus = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.faceRegistered = true;
        await user.save();
        res.json({
            message: 'Face status updated successfully',
            faceRegistered: user.faceRegistered,
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Register face data (images + embedding)
// @route   POST /api/auth/register-face
// @access  Private
const registerFace = async (req, res) => {
    try {
        const { studentId, images, accuracy, liveness } = req.body; // images: array of base64

        const user = await User.findById(studentId);
        if (!user) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // 1. Store images locally (or Cloudinary)
        const uploadDir = path.join(__dirname, '../../uploads/faces', studentId);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const imageUrls = [];
        images.forEach((imgBase64, index) => {
            const fileName = `face_${index}.jpg`;
            const filePath = path.join(uploadDir, fileName);
            const base64Data = imgBase64.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(filePath, base64Data, 'base64');
            imageUrls.push(`/uploads/faces/${studentId}/${fileName}`);
        });

        // 2. Call Python AI Service for embeddings
        console.log("Calling Python AI Service...");
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/generate-embedding`, {
            images: images
        });

        if (!aiResponse.data || !aiResponse.data.embedding) {
            return res.status(500).json({ message: 'Detection failed. Please follow instructions clearly.' });
        }

        const newEmbedding = aiResponse.data.embedding;

        // 3. **ANTI-FRAUD CHECK**: Use FAISS-based duplicate detection (85% threshold)
        console.log("🔍 Checking for duplicate face registration...");

        try {
            // Try FAISS-based duplicate check first (faster and more accurate)
            const duplicateCheck = await axios.post(`${process.env.AI_SERVICE_URL}/check-duplicate`, {
                embedding: newEmbedding,
                exclude_id: studentId.toString()
            });

            console.log("AI Service Response:", duplicateCheck.data);

            if (duplicateCheck.data.duplicate) {
                const existingUser = await User.findById(duplicateCheck.data.existingStudentId);

                console.warn(`⚠️ DUPLICATE FACE DETECTED! Similarity: ${duplicateCheck.data.similarity}%`);
                console.warn(`   Existing User: ${existingUser?.fullName} (${existingUser?.email})`);

                // Log fraud attempt
                await AuditLog.create({
                    action: 'duplicate_face_blocked',
                    userId: studentId,
                    performedBy: studentId,
                    details: {
                        attemptedBy: user.fullName,
                        attemptedEmail: user.email,
                        existingUser: existingUser?.fullName,
                        existingEmail: existingUser?.email,
                        similarity: duplicateCheck.data.similarity
                    },
                    severity: 'critical',
                    deviceIP: req.ip || req.connection?.remoteAddress || 'unknown',
                    userAgent: req.get('user-agent') || 'unknown'
                });

                return res.status(400).json({
                    message: `🚨 FRAUD DETECTED: This face is already registered to ${existingUser?.fullName || 'another student'} (${existingUser?.email || 'unknown'}). Similarity: ${duplicateCheck.data.similarity}%. You cannot register the same face with multiple accounts.`,
                    duplicate: true,
                    similarity: duplicateCheck.data.similarity,
                    existingUser: {
                        name: existingUser?.fullName,
                        email: existingUser?.email,
                        id: existingUser?._id
                    }
                });
            }
        } catch (faissError) {
            // FAISS not available, fallback to manual comparison with 85% threshold
            console.warn('⚠️ FAISS duplicate check failed, using manual comparison');

            const allUsers = await User.find({
                faceRegistered: true,
                faceEmbedding: { $exists: true, $ne: null },
                _id: { $ne: studentId }
            });

            const DUPLICATE_THRESHOLD = 0.85; // 85% threshold for duplicate detection

            for (const existingUser of allUsers) {
                if (existingUser.faceEmbedding && existingUser.faceEmbedding.length > 0) {
                    const similarity = cosineSimilarity(newEmbedding, existingUser.faceEmbedding);

                    if (similarity >= DUPLICATE_THRESHOLD) {
                        console.warn(`⚠️ DUPLICATE FACE DETECTED! Similarity: ${(similarity * 100).toFixed(2)}%`);
                        console.warn(`   User: ${existingUser.fullName} (${existingUser.email})`);

                        console.warn(`   User: ${existingUser.fullName} (${existingUser.email})`);

                        // Log fraud attempt
                        await AuditLog.create({
                            action: 'duplicate_face_blocked',
                            userId: studentId,
                            performedBy: studentId,
                            details: {
                                attemptedBy: user.fullName,
                                attemptedEmail: user.email,
                                existingUser: existingUser.fullName,
                                existingEmail: existingUser.email,
                                similarity: (similarity * 100).toFixed(2),
                                method: 'manual_fallback',
                                notes: 'FAISS service unavailable – duplicate caught by manual scan'
                            },
                            severity: 'critical',
                            deviceIP: req.ip || req.connection?.remoteAddress || 'unknown',
                            userAgent: req.get('user-agent') || 'unknown'
                        });

                        return res.status(400).json({
                            message: `🚨 FRAUD DETECTED: This face is already registered to ${existingUser.fullName} (${existingUser.email}). Similarity: ${(similarity * 100).toFixed(2)}%. You cannot register the same face with multiple accounts.`,
                            duplicate: true,
                            similarity: (similarity * 100).toFixed(2),
                            existingUser: {
                                name: existingUser.fullName,
                                email: existingUser.email,
                                id: existingUser._id
                            }
                        });
                    }
                }
            }
        }

        // 4. If no duplicate found, proceed with registration
        user.faceImages = imageUrls;
        user.faceEmbedding = newEmbedding;
        user.biometricAccuracy = accuracy || 99.8;
        user.livenessScore = liveness || 'Gold';
        user.faceRegistered = true;
        await user.save();

        // Update AI Service immediately
        try {
            await axios.post(`${process.env.AI_SERVICE_URL}/add-face`, {
                id: user._id.toString(),
                embedding: newEmbedding
            });
            console.log(`✅ AI Service updated for user ${user.fullName}`);
        } catch (updateError) {
            console.error(`⚠️ Failed to update AI Service: ${updateError.message}`);
        }

        res.status(200).json({
            message: 'Face Registered Successfully',
            faceRegistered: true
        });

    } catch (error) {
        console.error("Registration Error (Full):", error.response?.data || error.message);
        let msg = "AI Service Unavailable. Ensure Python server is running.";
        if (error.response?.data) {
            const data = error.response.data;
            msg = typeof data.detail === 'string' ? data.detail : (typeof data.message === 'string' ? data.message : JSON.stringify(data));
        } else if (error.message) {
            msg = error.message;
        }

        res.status(500).json({ message: msg });
    }
};

// Helper function: Calculate cosine similarity between two embeddings
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// @desc    Check face quality via AI service
// @route   POST /api/auth/face-quality
// @access  Private
const checkFaceQuality = async (req, res) => {
    try {
        const { image } = req.body;
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/face-quality`, {
            image: image
        });
        res.status(200).json(aiResponse.data);
    } catch (error) {
        res.status(500).json({ message: "AI Service Error" });
    }
};

// @desc    Verify face for attendance
const takeAttendanceVerify = async (req, res) => {
    try {
        const { image } = req.body;
        const students = await User.find({
            role: 'student',
            faceRegistered: true,
            faceEmbedding: { $exists: true, $not: { $size: 0 } }
        });

        if (students.length === 0) {
            return res.status(200).json({ match: false, message: "No registered students in system" });
        }

        const knownEmbeddings = students.map(s => ({
            id: s._id,
            embedding: s.faceEmbedding
        }));

        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/verify-face`, {
            image,
            known_embeddings: knownEmbeddings
        });

        if (aiResponse.data.match) {
            const student = await User.findById(aiResponse.data.studentId);
            return res.status(200).json({
                match: true,
                student: {
                    fullName: student.fullName,
                    className: student.className,
                    section: student.section,
                    id: student._id
                },
                confidence: aiResponse.data.confidence
            });
        }

        res.status(200).json(aiResponse.data);
    } catch (error) {
        res.status(500).json({ message: "Verification system error" });
    }
};

// @desc    Verify MULTIPLE faces for attendance (bulk scanning)
// @route   POST /api/auth/take-attendance-multiple
// @access  Private
const takeAttendanceMultiple = async (req, res) => {
    try {
        const { image } = req.body;
        const students = await User.find({
            role: 'student',
            faceRegistered: true,
            faceEmbedding: { $exists: true, $not: { $size: 0 } }
        });

        if (students.length === 0) {
            return res.status(200).json({ matches: [], message: "No registered students in system" });
        }

        const knownEmbeddings = students.map(s => ({
            id: s._id.toString(),
            embedding: s.faceEmbedding
        }));

        console.log(`🔍 Multi-Face Scan: Checking against ${students.length} registered students`);

        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/verify-multiple-faces`, {
            image,
            known_embeddings: knownEmbeddings
        });

        if (aiResponse.data.matches && aiResponse.data.matches.length > 0) {
            // Fetch full student details for all matches
            const matchedStudents = await Promise.all(
                aiResponse.data.matches.map(async (match) => {
                    const student = await User.findById(match.studentId);
                    return {
                        fullName: student.fullName,
                        className: student.className,
                        section: student.section,
                        rollNumber: student.rollNumber || 'N/A',
                        id: student._id,
                        confidence: match.confidence
                    };
                })
            );

            console.log(`✅ Matched ${matchedStudents.length} student(s)`);

            return res.status(200).json({
                matches: matchedStudents,
                totalDetected: aiResponse.data.totalDetected,
                totalMatched: aiResponse.data.totalMatched
            });
        }

        res.status(200).json(aiResponse.data);
    } catch (error) {
        console.error("Multi-Face Verification Error:", error.message);
        res.status(500).json({ message: "Multi-face verification system error" });
    }
};

// @desc    Get system statistics for dashboard
const getDashboardStats = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const registeredStudents = await User.countDocuments({
            role: 'student',
            faceRegistered: true,
            faceEmbedding: { $exists: true, $not: { $size: 0 } }
        });

        res.status(200).json({
            totalStudents,
            registeredStudents,
            unregisteredStudents: totalStudents - registeredStudents
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching stats" });
    }
};

// @desc    Get personal dashboard data for a student
const getStudentDashboardData = async (req, res) => {
    try {
        const student = await User.findById(req.user._id);
        if (!student || student.role !== 'student') {
            return res.status(403).json({ message: "Not authorized as student" });
        }

        // 1. Calculate Attendance Stats
        // Count confirmed attendance records for this student
        const attendedSessionsCount = await AttendanceRecord.countDocuments({
            studentId: student._id,
            matchStatus: 'confirmed'
        });

        // Get total sessions that have occurred for this student's class and section
        // We'll approximate this by counting finished sessions for their class
        const totalSessionsOccurred = await AttendanceSession.countDocuments({
            classId: student.className,
            section: student.section,
            active: false // Sessions that are completed
        });

        const attendancePercentage = totalSessionsOccurred > 0
            ? Math.round((attendedSessionsCount / totalSessionsOccurred) * 100)
            : 0;

        // 2. Identify Next Class
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];
        const currentTimeString = now.toTimeString().slice(0, 5); // "HH:mm"

        const timetable = await Timetable.findOne({
            className: student.className,
            section: student.section
        });

        let nextClass = null;
        if (timetable && timetable.schedule) {
            const todaySchedule = timetable.schedule.find(s => s.day === currentDay);
            if (todaySchedule && todaySchedule.periods) {
                // Sort periods by start time
                const sortedPeriods = todaySchedule.periods.sort((a, b) => a.startTime.localeCompare(b.startTime));

                // Find first period that starts after now
                nextClass = sortedPeriods.find(p => p.startTime > currentTimeString && p.type === 'period');

                // If no more classes today, maybe just leave it null or find first of tomorrow
                // For now, keep it simple: only today's next class
            }
        }

        // 3. Subject-wise Analytics for Bar Chart
        // Extract curriculum from timetable to ensure ALL subjects appear on X-Axis
        const curriculumSubjects = new Set();
        if (timetable && timetable.schedule) {
            timetable.schedule.forEach(day => {
                day.periods.forEach(p => {
                    if (p.type === 'period' && p.subject) {
                        curriculumSubjects.add(p.subject);
                    }
                });
            });
        }

        const subjectStatsRaw = await AttendanceSession.aggregate([
            {
                $match: {
                    classId: student.className,
                    section: student.section,
                    active: false
                }
            },
            {
                $group: {
                    _id: "$subjectName",
                    totalSessions: { $sum: 1 }
                }
            }
        ]);

        const studentAttendanceRaw = await AttendanceRecord.aggregate([
            {
                $match: {
                    studentId: student._id,
                    matchStatus: 'confirmed'
                }
            },
            {
                $lookup: {
                    from: "attendancesessions",
                    localField: "sessionId",
                    foreignField: "_id",
                    as: "session"
                }
            },
            { $unwind: "$session" },
            {
                $group: {
                    _id: "$session.subjectName",
                    attendedCount: { $sum: 1 }
                }
            }
        ]);

        // Merge timetable subjects with actual attendance data
        // This ensures subjects with 0% attendance still show up on the graph (X-Axis)
        const subjectWiseAttendance = Array.from(curriculumSubjects).map(subjectName => {
            const stats = subjectStatsRaw.find(s => s._id === subjectName);
            const total = stats ? stats.totalSessions : 0;
            const attended = studentAttendanceRaw.find(sa => sa._id === subjectName);
            const count = attended ? attended.attendedCount : 0;

            return {
                subject: subjectName,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0,
                attended: count,
                total: total
            };
        });

        // Add any subjects found in sessions that might not be in the timetable (fallback)
        subjectStatsRaw.forEach(s => {
            if (!curriculumSubjects.has(s._id)) {
                const attended = studentAttendanceRaw.find(sa => sa._id === s._id);
                const count = attended ? attended.attendedCount : 0;
                subjectWiseAttendance.push({
                    subject: s._id,
                    percentage: Math.round((count / s.totalSessions) * 100) || 0,
                    attended: count,
                    total: s.totalSessions
                });
            }
        });

        // 4. Fetch Recent Attendance History (Ledger)
        const recentRecords = await AttendanceRecord.find({
            studentId: student._id
        })
            .populate({
                path: 'sessionId',
                select: 'subjectName startTime'
            })
            .sort({ timestamp: -1 })
            .limit(5);

        const recentActivity = recentRecords.map(rec => ({
            id: rec._id,
            subject: rec.sessionId?.subjectName || "System Event",
            date: rec.timestamp,
            status: rec.matchStatus === 'confirmed' ? 'Present' : 'Failed',
            confidence: rec.confidenceScore,
            time: new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        // 5. Final Stats Assembly with Dynamic Suggestion Logic
        let status = "Critical";
        let trend = "Academic risk detected.";

        if (attendancePercentage >= 90) {
            status = "Elite";
            trend = "Mastery achieved. Perfect consistency.";
        } else if (attendancePercentage >= 75) {
            status = "Professional";
            trend = "Institutional requirements satisfied.";
        } else if (attendancePercentage >= 60) {
            status = "Risk";
            const needed = Math.max(0, Math.ceil((0.75 * totalSessionsOccurred - attendedSessionsCount) / 0.25));
            trend = `Attend next ${needed} classes to reach 75%.`;
        } else {
            status = "Critical";
            const needed = Math.max(0, Math.ceil((0.75 * totalSessionsOccurred - attendedSessionsCount) / 0.25));
            trend = `Immediate action: ${needed} sessions needed for 75%.`;
        }

        res.status(200).json({
            user: student,
            stats: {
                percentage: attendancePercentage,
                attended: attendedSessionsCount,
                total: totalSessionsOccurred,
                status: status,
                trend: trend
            },
            nextClass: nextClass ? {
                subject: nextClass.subject,
                time: nextClass.startTime,
                room: "General Classroom",
                faculty: nextClass.facultyName || "To be assigned"
            } : null,
            recentActivity,
            subjectWiseAttendance,
            biometrics: {
                registered: student.faceRegistered,
                images: student.faceImages || [],
                accuracy: student.biometricAccuracy || 0,
                liveness: student.livenessScore || 'Pending'
            }
        });

    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error.message);
        res.status(500).json({ message: "Error fetching student dashboard data" });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.fullName = req.body.fullName || user.fullName;
            user.email = req.body.email || user.email;
            user.phoneNumber = req.body.phoneNumber || user.phoneNumber;
            user.parentPhoneNumber = req.body.parentPhoneNumber || user.parentPhoneNumber;

            // Handle profile picture (can be base64 string or null for deletion)
            if (req.body.profilePicture !== undefined) {
                user.profilePicture = req.body.profilePicture;
            }

            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                role: updatedUser.role,
                className: updatedUser.className,
                section: updatedUser.section,
                phoneNumber: updatedUser.phoneNumber,
                parentPhoneNumber: updatedUser.parentPhoneNumber,
                profilePicture: updatedUser.profilePicture,
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

// @desc    Get detailed student analytics
// @route   GET /api/auth/analytics
// @access  Private
const getDetailedAnalytics = async (req, res) => {
    try {
        const student = await User.findById(req.user._id);
        if (!student || student.role !== 'student') {
            return res.status(403).json({ message: "Not authorized as student" });
        }

        // 1. Total Summary
        const attendedRecords = await AttendanceRecord.countDocuments({
            studentId: student._id,
            matchStatus: { $in: ['confirmed', 'weak'] }
        });

        const totalScheduledSessions = await AttendanceSession.countDocuments({
            classId: student.className,
            section: student.section,
            active: false
        });

        const absentCount = Math.max(0, totalScheduledSessions - attendedRecords);
        const overallPercentage = totalScheduledSessions > 0
            ? Math.round((attendedRecords / totalScheduledSessions) * 100)
            : 0;

        // 2. Monthly Trend (Line Chart Data)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const monthlyStats = await AttendanceSession.aggregate([
            {
                $match: {
                    classId: student.className,
                    section: student.section,
                    active: false,
                    startTime: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$startTime' },
                        month: { $month: '$startTime' }
                    },
                    sessionIds: { $push: '$_id' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        const monthlyTrend = [];
        for (const stat of monthlyStats) {
            const attendedInMonth = await AttendanceRecord.countDocuments({
                studentId: student._id,
                sessionId: { $in: stat.sessionIds },
                matchStatus: { $in: ['confirmed', 'weak'] }
            });

            monthlyTrend.push({
                month: new Date(stat._id.year, stat._id.month - 1).toLocaleString('default', { month: 'short' }),
                percentage: Math.round((attendedInMonth / stat.sessionIds.length) * 100)
            });
        }

        // 3. Subject-wise Breakdown (Consolidated with Timetable)
        const timetable = await Timetable.findOne({ className: student.className, section: student.section });
        const allSubjects = new Set();
        if (timetable) {
            timetable.schedule.forEach(day => {
                day.periods.forEach(p => {
                    if (p.subject && p.type === 'period') allSubjects.add(p.subject);
                });
            });
        }

        const subjectStatsRaw = await AttendanceSession.aggregate([
            {
                $match: {
                    classId: student.className,
                    section: student.section,
                    active: false
                }
            },
            {
                $group: {
                    _id: "$subjectName",
                    totalSessions: { $sum: 1 }
                }
            }
        ]);

        const studentAttendanceRaw = await AttendanceRecord.aggregate([
            {
                $match: {
                    studentId: student._id,
                    matchStatus: { $in: ['confirmed', 'weak'] }
                }
            },
            {
                $lookup: {
                    from: "attendancesessions",
                    localField: "sessionId",
                    foreignField: "_id",
                    as: "session"
                }
            },
            { $unwind: "$session" },
            {
                $group: {
                    _id: "$session.subjectName",
                    attendedCount: { $sum: 1 }
                }
            }
        ]);

        // Merge Timetable subjects with Session subjects
        const consolidatedSubjects = Array.from(allSubjects);
        subjectStatsRaw.forEach(s => {
            if (!allSubjects.has(s._id)) consolidatedSubjects.push(s._id);
        });

        const subjectBreakdown = consolidatedSubjects.map(subName => {
            const sessions = subjectStatsRaw.find(s => s._id === subName);
            const attended = studentAttendanceRaw.find(sa => sa._id === subName);

            const total = sessions ? sessions.totalSessions : 0;
            const count = attended ? attended.attendedCount : 0;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 100; // 100% if no sessions held yet

            let status = 'Safe';
            if (total > 0) {
                if (percentage < 65) status = 'Critical';
                else if (percentage < 75) status = 'Warning';
            }

            return {
                subject: subName,
                total: total,
                present: count,
                absent: total - count,
                percentage,
                status
            };
        });

        // 4. Heatmap Data (Enhanced Spatio-Temporal Mapping)
        const heatmapLimit = new Date();
        heatmapLimit.setDate(heatmapLimit.getDate() - 30);
        heatmapLimit.setHours(0, 0, 0, 0);

        const presenceRecords = await AttendanceRecord.find({
            studentId: student._id,
            matchStatus: { $in: ['confirmed', 'weak'] },
            timestamp: { $gte: heatmapLimit }
        }).select('timestamp');

        const sessionsForStudent = await AttendanceSession.find({
            classId: student.className,
            section: student.section,
            active: false,
            startTime: { $gte: heatmapLimit }
        }).select('startTime');

        const presentDates = new Set(presenceRecords.map(r => r.timestamp.toISOString().split('T')[0]));
        const sessionDates = new Set(sessionsForStudent.map(s => s.startTime.toISOString().split('T')[0]));

        const absentDates = [];
        sessionDates.forEach(date => {
            if (!presentDates.has(date)) absentDates.push(date);
        });

        const heatmap = {
            present: Array.from(presentDates),
            absent: absentDates
        };

        // 5. AI Predictions & Calculator
        const REQUIRED_PERCENTAGE = 75;
        let prediction = "";
        let recommendation = "";
        let neededClasses = 0;

        if (overallPercentage < REQUIRED_PERCENTAGE) {
            neededClasses = Math.ceil((0.75 * totalScheduledSessions - attendedRecords) / 0.25);
            recommendation = `Attend next ${neededClasses > 0 ? neededClasses : 1} classes continuously to reach ${REQUIRED_PERCENTAGE}%.`;
            prediction = "Current trajectory shows academic risk. Immediate attendance boosting required.";
        } else {
            const canMiss = Math.floor((attendedRecords - 0.75 * totalScheduledSessions) / 0.75);
            recommendation = `You can miss up to ${canMiss > 0 ? canMiss : 0} classes and still stay above ${REQUIRED_PERCENTAGE}%.`;
            prediction = "Academic standing is robust. Maintain current consistency.";
            neededClasses = 0;
        }

        // 6. Trend Indicator
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const currentMonthAttended = await AttendanceRecord.countDocuments({
            studentId: student._id,
            matchStatus: { $in: ['confirmed', 'weak'] },
            timestamp: { $gte: thirtyDaysAgo }
        });
        const currentMonthSessions = await AttendanceSession.find({
            classId: student.className,
            section: student.section,
            active: false,
            startTime: { $gte: thirtyDaysAgo }
        });
        const currentMonthTotal = currentMonthSessions.length;

        const prevMonthAttended = await AttendanceRecord.countDocuments({
            studentId: student._id,
            matchStatus: { $in: ['confirmed', 'weak'] },
            timestamp: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
        });
        const prevMonthSessions = await AttendanceSession.find({
            classId: student.className,
            section: student.section,
            active: false,
            startTime: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
        });
        const prevMonthTotal = prevMonthSessions.length;

        const currentRate = currentMonthTotal > 0 ? currentMonthAttended / currentMonthTotal : 0;
        const prevRate = prevMonthTotal > 0 ? prevMonthAttended / prevMonthTotal : 0;

        let trendIndicator = "Stable";
        if (currentRate > prevRate + 0.05) trendIndicator = "Improving";
        else if (currentRate < prevRate - 0.05) trendIndicator = "Declining";

        res.status(200).json({
            summary: {
                className: student.className,
                section: student.section,
                totalClasses: totalScheduledSessions,
                present: attendedRecords,
                absent: absentCount,
                percentage: overallPercentage,
                required: REQUIRED_PERCENTAGE,
                trend: trendIndicator
            },
            monthlyTrend,
            subjectBreakdown,
            heatmap,
            aiInsights: {
                prediction,
                recommendation,
                neededToReach75: neededClasses
            },
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error("Detailed Analytics Error:", error);
        res.status(500).json({ message: "Error fetching detailed analytics" });
    }
};

// @desc    Delete the currently authenticated user's own account (fraud purge)
// @route   DELETE /api/auth/delete-self
// @access  Private
const deleteSelf = async (req, res) => {
    try {
        const student = await User.findById(req.user._id);
        if (!student) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Only allow students to self-delete (safety guard)
        if (student.role !== 'student') {
            return res.status(403).json({ message: 'Not authorized to delete this account' });
        }

        // Remove face images from disk if they exist
        const uploadDir = path.join(__dirname, '../../uploads/faces', student._id.toString());
        if (fs.existsSync(uploadDir)) {
            fs.rmSync(uploadDir, { recursive: true, force: true });
            console.log(`🗑️ Deleted face images for user ${student.fullName}`);
        }

        await student.deleteOne();
        console.log(`🚨 FRAUD PURGE: Account deleted for ${student.fullName} (${student.email})`);

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete Self Error:', error);
        res.status(500).json({ message: 'Server error during account deletion' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    updateFaceStatus,
    registerFace,
    checkFaceQuality,
    takeAttendanceVerify,
    takeAttendanceMultiple,
    getDashboardStats,
    getStudentDashboardData,
    forgotPassword,
    resetPassword,
    updateUserProfile,
    getDetailedAnalytics,
    deleteSelf,
};
