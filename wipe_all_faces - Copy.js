require('dotenv').config();
const mongoose = require('mongoose');

async function wipeAllFaces() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const User = require('./src/models/User');

        const result = await User.updateMany(
            {},
            {
                $set: {
                    faceRegistered: false,
                    faceEmbedding: []
                }
            }
        );

        console.log(`✅ Success: Reset face data for ${result.modifiedCount} users.`);

        // Now sync with AI service to clear its memory too
        const axios = require('axios');
        await axios.post(`${process.env.AI_SERVICE_URL}/build-faiss-index`, {
            embeddings: []
        });

        console.log("✅ Success: AI Service memory cleared.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err.message);
        process.exit(1);
    }
}

wipeAllFaces();
