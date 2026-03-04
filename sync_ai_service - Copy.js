const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./src/models/User');
const dotenv = require('dotenv');

const path = require('path');

// Load env vars from the same directory as this script
dotenv.config({ path: path.join(__dirname, '.env') });

const syncFaiss = async () => {
    try {
        console.log('--- Syncing MongoDB Users with AI Service ---');

        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        // 2. Fetch all users with face embeddings
        const users = await User.find({
            faceEmbedding: { $exists: true, $not: { $size: 0 } }
        });

        console.log(`🔍 Found ${users.length} users with face embeddings.`);

        // 3. Prepare payload for AI Service
        const embeddingsPayload = users.map(user => ({
            id: user._id.toString(),
            embedding: user.faceEmbedding
        }));

        // 4. Send to AI Service
        console.log('📤 Sending data to AI Service (build-faiss-index)...');
        try {
            const response = await axios.post(`${process.env.AI_SERVICE_URL}/build-faiss-index`, {
                embeddings: embeddingsPayload
            });
            console.log(`✅ Success: ${response.data.message}`);
        } catch (aiError) {
            console.error(`❌ AI Service Error: ${aiError.message}`);
            if (aiError.code === 'ECONNREFUSED') {
                console.error('   (Is the python ai-service running?)');
            }
        }

        process.exit();
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

syncFaiss();
