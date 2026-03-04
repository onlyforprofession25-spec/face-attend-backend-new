const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./src/models/User');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const forceCleanup = async () => {
    try {
        console.log("🧹 STARTING FORCE CLEANUP");

        const aiUrl = 'http://localhost:8000';

        // 1. Wipe AI Index
        console.log("1. Sending EMPTY index to AI Service...");
        try {
            await axios.post(`${aiUrl}/build-faiss-index`, { embeddings: [] });
            console.log("   ✅ AI Index Wiped.");
        } catch (e) {
            console.log("   ❌ Failed to wipe: " + e.message);
        }

        // 2. Load Valid Users
        console.log("2. Loading valid users from MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({ faceEmbedding: { $exists: true, $not: { $size: 0 } } });
        console.log(`   ✅ Found ${users.length} valid users.`);

        // 3. Rebuild AI Index
        console.log("3. Sending valid users to AI Service...");
        const payload = users.map(u => ({
            id: u._id.toString(),
            embedding: u.faceEmbedding
        }));

        if (payload.length > 0) {
            await axios.post(`${aiUrl}/build-faiss-index`, { embeddings: payload });
            console.log(`   ✅ Rebuilt index with ${payload.length} users.`);
        } else {
            console.log("   ⚠️ No users to send. Index remains empty (Correct).");
        }

        console.log("✅ CLEANUP COMPLETE. Try registering now.");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

forceCleanup();
