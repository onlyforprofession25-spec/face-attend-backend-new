const mongoose = require('mongoose');
const Timetable = require('./src/models/Timetable');
const dotenv = require('dotenv');
dotenv.config();

async function checkRaw() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tt = await Timetable.findOne({ className: "10", section: "A" });
        const daySched = tt.schedule.find(s => s.day.toLowerCase().includes("sun"));
        if (daySched) {
            console.log("Day value length:", daySched.day.length);
            console.log("Day value char codes:", [...daySched.day].map(c => c.charCodeAt(0)));
            console.log("Day value JSON:", JSON.stringify(daySched.day));
        }
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
checkRaw();
