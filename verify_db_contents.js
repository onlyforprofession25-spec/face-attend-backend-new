const mongoose = require('mongoose');
const User = require('./src/models/User');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const verifyDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const allUsers = await User.find({});
        console.log(`\n--- ALL USERS IN MONGODB (${allUsers.length}) ---`);
        allUsers.forEach(u => {
            console.log(`ID: ${u._id}`);
            console.log(`Name: ${u.fullName}`);
            console.log(`Email: ${u.email}`);
            console.log(`Has Face Embedding? ${u.faceEmbedding && u.faceEmbedding.length > 0 ? "YES" : "NO"}`);
            console.log('---');
        });

        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

verifyDB();
