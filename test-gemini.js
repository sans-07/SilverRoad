require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { console.error("No Key"); return; }

    try {
        console.log("Connecting to Gemini API...");
        const genAI = new GoogleGenerativeAI(key);
        // Using the verified available model
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const result = await model.generateContent("Hello, strictly answer with 'OK'.");
        const response = await result.response;
        const text = response.text();

        console.log("✅ SUCCESS! Gemini responded:");
        console.log(text);
    } catch (error) {
        console.error("❌ FAILURE: API Call failed.");
        console.error(error);
    }
}

testGemini();
