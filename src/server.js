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
// Function to Sync AI Memory with MongoDB on Startup (With Robust Retries for Hugging Face)
// Function to Sync AI Memory with MongoDB on Startup (Professional Guard Edition)
const syncAIFaces = async (attempt = 1) => {
    const MAX_ATTEMPTS = 15; // Give it 150 seconds (2.5 mins) to wake up/download models
    const User = require('./models/User');
    const axios = require('axios');
    const AI_URL = process.env.AI_SERVICE_URL;

    if (!AI_URL) {
        console.warn('⚠️ AI_SERVICE_URL not set. Skipping biometric sync.');
        return;
    }

    try {
        // 🔍 Step 1: Health Check (Is the AI even awake?)
        console.log(`🛰️ [Sync Attempt ${attempt}] Connecting to AI Engine at ${AI_URL}...`);
        const status = await axios.get(`${AI_URL}/check-status`, { timeout: 5000 });

        if (status.data.status === 'online') {
            console.log('🧠 AI Engine is Awake. Checking database...');

            // 🔍 Step 2: Fetch Students from MongoDB
            const students = await User.find({
                role: 'student',
                faceRegistered: true,
                faceEmbedding: { $exists: true, $ne: [] }
            }).select('_id faceEmbedding fullName');

            if (students.length > 0) {
                console.log(`📥 Pushing ${students.length} biometric fingerprints to AI Memory...`);

                const response = await axios.post(`${AI_URL}/build-faiss-index`, {
                    embeddings: students.map(s => ({
                        id: s._id.toString(),
                        embedding: s.faceEmbedding
                    }))
                });

                console.log(`✅ [MASTER SYNC] ${response.data.message}`);
            } else {
                console.log('ℹ️ Sync: No students found in database. Ready for new registrations.');
            }
        }
    } catch (err) {
        if (attempt < MAX_ATTEMPTS) {
            const reason = err.response ? `AI warming up (${err.response.status})` : err.message;
            console.log(`⏳ AI still warming up: ${reason}. Retrying in 10s...`);
            setTimeout(() => syncAIFaces(attempt + 1), 10000);
        } else {
            console.error('🔥 CRITICAL: AI could not be reached after 15 attempts. Attendance will not work.');
        }
    }
};

// 🚀 MASTER SYNC ROUTE: Use this to "Refresh the Brain" of the AI Service
app.get('/api/admin/force-sync', async (req, res) => {
    try {
        console.log('🔗 [MANUAL SYNC] Force-Sync triggered via API...');
        await syncAIFaces();
        res.json({ success: true, message: "AI Memory Sync Started. Check terminal logs for progress." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, async () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    // Run sync after server is up
    syncAIFaces();
});
