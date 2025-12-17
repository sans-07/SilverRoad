const express = require('express');
const router = express.Router();
const { generateDailySummary } = require('../services/aiService');

// Pass db instance via closure or middleware if needed, but here we'll export a function that takes them
module.exports = (db) => {

    // POST /api/ai/summary
    router.post('/ai/summary', async (req, res) => {
        try {
            const { ansimId } = req.body;

            if (!ansimId) {
                return res.status(400).json({ error: "ansimId is required" });
            }

            // Using the service to generate summary
            const summary = await generateDailySummary(ansimId, db);

            res.json({ summary });

        } catch (error) {
            console.error("Route Error:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
