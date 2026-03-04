const mongoose = require('mongoose');
const AttendanceSession = require('./src/models/AttendanceSession');
const AttendanceRecord = require('./src/models/AttendanceRecord');
require('dotenv').config();

async function checkSessions() {
    await mongoose.connect(process.env.MONGO_URI);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await AttendanceSession.find({ createdAt: { $gt: today } });
    console.log(`Today's sessions: ${sessions.length}`);

    for (const s of sessions) {
        const records = await AttendanceRecord.countDocuments({ sessionId: s._id });
        console.log(`Session ${s.sessionId}: ${s.className}-${s.section}, Subject: ${s.subjectName}, Active: ${s.active}, Records: ${records}`);
    }
    process.exit(0);
}
checkSessions();
