const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            required: true,
            enum: ['student', 'faculty', 'admin'],
            default: 'student',
        },
        // Student specifics
        age: { type: Number },
        className: { type: String },
        section: { type: String },

        // Faculty specifics
        employeeId: { type: String },
        subjects: [{ type: String }], // Array of subjects taught
        assignedClasses: [
            {
                className: { type: String },
                section: { type: String },
                subject: { type: String }
            }
        ],

        faceRegistered: {
            type: Boolean,
            default: false,
        },
        faceImages: [
            { type: String }
        ],
        faceEmbedding: [
            { type: Number }
        ],
        biometricAccuracy: {
            type: Number,
            default: 0
        },
        livenessScore: {
            type: String,
            default: 'Pending'
        },
        profilePicture: { type: String },
        phoneNumber: { type: String },
        parentPhoneNumber: { type: String }, // Student only
        resetPasswordToken: String,
        resetPasswordExpire: Date,
    },
    {
        timestamps: true,
    }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
