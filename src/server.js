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

app.use(cors());
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

app.listen(
    PORT,
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
);
