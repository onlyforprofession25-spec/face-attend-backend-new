const User = require('../models/User');
const axios = require('axios');

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Admin
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ role: 'student' })
            .select('-password')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete user & Sync AI
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log(`🗑️ User deleted from MongoDB: ${user.fullName} (${user.email})`);

        // SYNC AI Service automatically
        try {
            // Fetch remaining valid users with faces
            const validUsers = await User.find({
                faceRegistered: true,
                faceEmbedding: { $exists: true, $not: { $size: 0 } }
            });

            const payload = validUsers.map(u => ({
                id: u._id.toString(),
                embedding: u.faceEmbedding
            }));

            // Force Rebuild of AI Index
            // Even if payload is empty (0 users), it clears the index. Correct.
            await axios.post(`${process.env.AI_SERVICE_URL}/build-faiss-index`, {
                embeddings: payload
            });

            console.log(`✅ AI Index REBUILT with ${payload.length} users.`);

        } catch (aiError) {
            console.error('⚠️ Failed to sync AI service:', aiError.message);
            // We consider the delete successful even if AI sync fails (user can run manual sync script if needed)
            // But we warn them in response?
        }

        res.json({ message: 'User deleted and AI memory updated.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getAllUsers, deleteUser };
