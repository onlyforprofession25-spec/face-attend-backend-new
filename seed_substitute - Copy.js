const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

const seedMasterSubstitute = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/faceattend');

        const existing = await User.findOne({ email: 'adminfaculty' });
        if (existing) {
            console.log('Master Substitute already exists.');
            process.exit(0);
        }

        await User.create({
            fullName: 'Substitute Authority',
            email: 'adminfaculty',
            password: '12345678', // This will be hashed by the model pre-save hook
            role: 'faculty',
            employeeId: 'SUB-001',
            age: 0,
            subjects: [],
            assignedClasses: []
        });

        console.log('✅ Master Substitute (adminfaculty/12345678) created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding master substitute:', err);
        process.exit(1);
    }
};

seedMasterSubstitute();
