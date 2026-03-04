const mongoose = require('mongoose');
const User = require('./src/models/User');
const dotenv = require('dotenv');
dotenv.config();

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({ className: "10", section: "A" });
        console.log(`Found ${users.length} users in 10A`);
        users.forEach(u => console.log(`${u.fullName} - ${u.role} - ${u.email}`));
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}
checkUsers();
