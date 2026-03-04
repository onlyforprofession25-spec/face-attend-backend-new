const User = require('./src/models/User');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const mongoose = require('mongoose');
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({});
        console.log(`\nFound ${users.length} users in DB:`);
        users.forEach(u => console.log(`- ${u.fullName} (${u.email})`));
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
