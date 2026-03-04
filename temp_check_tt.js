const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const Timetable = require('./src/models/Timetable');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const checkFacultyTimetable = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error("MONGO_URI NOT FOUND in .env");
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI);

        const faculty = await User.findOne({ email: 'facultys@gmail.com' });
        if (!faculty) {
            const allUsers = await User.find({}, { email: 1 });
            console.log("Faculty not found. Available emails:", allUsers.map(u => u.email));
            process.exit();
        }

        console.log(`\n--- TIMETABLE FOR FACULTY: ${faculty.fullName} (${faculty.email}) ---`);

        const timetables = await Timetable.find(); // Find all to see matches
        console.log(`Found ${timetables.length} timetables in total`);

        timetables.forEach(tt => {
            console.log(`\nAnalyzing Timetable for Class: ${tt.className} Section: ${tt.section}`);
            tt.schedule.forEach(day => {
                if (day.day.toLowerCase() === 'monday') {
                    console.log(`  Day: ${day.day}`);
                    day.periods.forEach(p => {
                        console.log(`    ${p.startTime} - ${p.endTime}: ${p.subject} (${p.type})`);
                    });
                }
            });
        });

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkFacultyTimetable();
