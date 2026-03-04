const mongoose = require('mongoose');
const User = require('./src/models/User');
const Timetable = require('./src/models/Timetable');
const dotenv = require('dotenv');
dotenv.config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const timetables = await Timetable.find();
        console.log("\n--- TIMETABLES ---");
        timetables.forEach(tt => {
            console.log(`Class: ${tt.className}, Section: ${tt.section}`);
            tt.schedule.forEach(s => {
                if (s.periods.length > 0) {
                    console.log(`  Day: ${s.day}`);
                    s.periods.forEach(p => console.log(`    ${p.startTime}-${p.endTime}: ${p.subject}`));
                }
            });
        });

        const faculties = await User.find({ role: 'faculty' });
        console.log("\n--- FACULTIES ---");
        faculties.forEach(f => {
            console.log(`Name: ${f.fullName}, Email: ${f.email}`);
            console.log(`  Assigned:`, JSON.stringify(f.assignedClasses, null, 2));
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
