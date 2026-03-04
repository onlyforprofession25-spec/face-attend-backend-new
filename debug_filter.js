const mongoose = require('mongoose');
const User = require('./src/models/User');
const Timetable = require('./src/models/Timetable');
const dotenv = require('dotenv');
dotenv.config();

const normalize = (s) => String(s || "").trim().toLowerCase();

async function debugFilter() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const faculty = await User.findOne({ email: 'facultys@gmail.com' });
        if (!faculty) {
            console.log("Faculty not found");
            process.exit(1);
        }

        console.log("Faculty Name:", faculty.fullName);
        console.log("Faculty Normalized Name:", normalize(faculty.fullName));
        console.log("Assigned Classes:", JSON.stringify(faculty.assignedClasses, null, 2));

        const tt = await Timetable.findOne({ className: "10", section: "A" });
        if (!tt) {
            console.log("Timetable 10A not found");
            process.exit(1);
        }

        const sunday = tt.schedule.find(s => normalize(s.day) === "sunday");
        if (sunday) {
            console.log("\nSunday Periods in DB:");
            sunday.periods.forEach((p, i) => {
                console.log(`Period ${i}:`);
                console.log(`  Subject: "${p.subject}" (Normalized: "${normalize(p.subject)}")`);
                console.log(`  Faculty: "${p.facultyName}" (Normalized: "${normalize(p.facultyName)}")`);

                // Simulate filter logic
                const matchingAssignments = faculty.assignedClasses.filter(ac =>
                    normalize(ac.className) === normalize(tt.className) &&
                    normalize(ac.section) === normalize(tt.section)
                );
                const subjectsTeached = matchingAssignments.map(ma => normalize(ma.subject));
                const facultyNameNorm = normalize(faculty.fullName);

                const isSubjectMatch = subjectsTeached.includes(normalize(p.subject));
                const isNameMatch = normalize(p.facultyName) === facultyNameNorm;
                const isFallbackMatch = matchingAssignments.length > 0 && !p.facultyName;

                console.log(`  Included? ${isSubjectMatch || isNameMatch || isFallbackMatch} (Subject Match: ${isSubjectMatch}, Name Match: ${isNameMatch}, Fallback Match: ${isFallbackMatch})`);
            });
        } else {
            console.log("No Sunday found in 10A timetable");
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
debugFilter();
