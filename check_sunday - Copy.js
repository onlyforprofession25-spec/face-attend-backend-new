const mongoose = require('mongoose');
const User = require('./src/models/User');
const Timetable = require('./src/models/Timetable');
const dotenv = require('dotenv');
dotenv.config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const timetables = await Timetable.find({ className: "10", section: "A" });
        timetables.forEach(tt => {
            const sunday = tt.schedule.find(s => s.day === "Sunday");
            if (sunday) {
                console.log("Sunday Periods for 10A:");
                sunday.periods.forEach(p => {
                    console.log(`- Subject: ${p.subject}, Faculty: ${p.facultyName}, Time: ${p.startTime}-${p.endTime}`);
                });
            }
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkData();
