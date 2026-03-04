const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const AttendanceSession = require('./src/models/AttendanceSession');
const Timetable = require('./src/models/Timetable');

dotenv.config({ path: '.env' });

const checkStats = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const student = await User.findOne({ role: 'student' });
        if (!student) {
            console.log("No student found");
            process.exit();
        }

        console.log(`\n--- ANALYSIS FOR STUDENT: ${student.fullName} (${student.className}/${student.section}) ---`);

        // 1. Subjects with completed sessions for THIS student's class
        const sessionSubjectsRaw = await AttendanceSession.aggregate([
            { $match: { classId: student.className, section: student.section, active: false } },
            { $group: { _id: "$subjectName" } }
        ]);
        const sessionSubjects = sessionSubjectsRaw.map(s => s._id);
        console.log(`\nSubjects with completed sessions: [${sessionSubjects.length}]`);
        sessionSubjects.forEach(s => console.log(`- ${s}`));

        // 2. Subjects in THIS student's Timetable
        const timetable = await Timetable.findOne({ className: student.className, section: student.section });
        const ttSubjects = new Set();
        if (timetable) {
            timetable.schedule.forEach(day => {
                day.periods.forEach(p => {
                    if (p.subject && p.type === 'period') ttSubjects.add(p.subject);
                });
            });
        }
        console.log(`\nSubjects in Timetable (Type: period): [${ttSubjects.size}]`);
        ttSubjects.forEach(s => console.log(`- ${s}`));

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkStats();
