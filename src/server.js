const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const facultyRoutes = require('./routes/faculty.routes');
const adminRoutes = require('./routes/admin.routes');

dotenv.config();

connectDB();

const path = require('path');
const app = express();

// Explicit CORS configuration for Vercel
app.use(cors({
    origin: ["https://frontend-nine-liart-53.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning", "x-proxy-faculty"],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static folder for face images with ngrok bypass
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    setHeaders: (res) => {
        res.set('ngrok-skip-browser-warning', 'true');
    }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/discussion', require('./routes/discussion.routes'));
app.use('/api/diary', require('./routes/diary.routes'));
app.use('/api/personal-diary', require('./routes/personalDiary.routes'));
app.use('/api/events', require('./routes/event.routes'));

app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

// Function to Sync AI Memory with MongoDB on Startup
const syncAIFaces = async () => {
    try {
        const User = require('./models/User');
        const axios = require('axios');

        console.log('🔄 Initializing AI Memory Sync...');
        const students = await User.find({
            role: 'student',
            faceRegistered: true,
            faceEmbedding: { $exists: true, $ne: null }
        });

        if (students.length > 0) {
            const embeddings = students.map(s => ({
                id: s._id.toString(),
                embedding: s.faceEmbedding
            }));

            await axios.post(`${process.env.AI_SERVICE_URL}/build-faiss-index`, {
                embeddings
            });

            console.log(`✅ AI Memory Synced: ${students.length} students loaded.`);
        } else {
            console.log('ℹ️ AI Sync: No registered students found in MongoDB yet.');
        }
    } catch (err) {
        console.error('❌ AI Memory Sync Failed:', err.message);
    }
};

app.listen(PORT, async () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    // Run sync after server is up
    await syncAIFaces();
});
