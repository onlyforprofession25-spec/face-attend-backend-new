const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./src/models/User'); // Adjust if running from root
const dotenv = require('dotenv');

dotenv.config({ path: '.env' }); // Load .env from current dir

const fixMismatch = async () => {
    try {
        console.log("🛠️  Running Mismatch Fixer...");

        // 1. Connect to DB
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected");

        // 2. Identify the Ghost User from your log
        const ghostId = '69876eed6e3f531fcc0dfca9'; // From your error log

        // 3. Verify it's GONE
        const user = await User.findById(ghostId);
        if (!user) {
            console.log(`✅ Confirmed: ID ${ghostId} does NOT exist in MongoDB.`);
        } else {
            console.log(`⚠️  Wait, User DOES exist: ${user.fullName}`);
        }

        // 4. Force AI Service to forget it by overwriting index
        console.log("\n🔄 Forcing AI Service to Sync with MongoDB...");

        // Get valid users
        const validUsers = await User.find({ faceEmbedding: { $exists: true, $not: { $size: 0 } } });
        console.log(`   found ${validUsers.length} valid users with faces.`);

        const payload = validUsers.map(u => ({
            id: u._id.toString(),
            embedding: u.faceEmbedding
        }));

        try {
            const res = await axios.post('http://localhost:8000/build-faiss-index', {
                embeddings: payload
            });
            console.log(`✅ AI Service Updated: ${res.data.message}`);
            console.log("🎉 Ghost user " + ghostId + " is now REMOVED from AI memory.");
        } catch (e) {
            console.error("❌ Failed to contact AI Service. Is python main.py running?");
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fixMismatch();
