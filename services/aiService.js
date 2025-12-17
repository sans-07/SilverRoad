const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getDistance } = require("./locationService");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateDailySummary(ansimId, db) {
    try {
        // 1. Fetch today's location data
        // (In a real app, you'd filter by timestamp for "today". 
        // For now, we'll fetch recent locations to ensure we have data to summarize)
        const locationsSnapshot = await db.collection('users').doc(ansimId).collection('locations')
            .orderBy('time', 'desc')
            .limit(50) // Analyze last 50 points
            .get();

        if (locationsSnapshot.empty) {
            return "오늘의 활동 기록이 충분하지 않아 요약을 생성할 수 없습니다.";
        }

        const locations = [];
        locationsSnapshot.forEach(doc => locations.push(doc.data()));

        // Sort by time ascending for analysis
        locations.sort((a, b) => new Date(a.time) - new Date(b.time));

        // 2. Calculate basic stats
        let totalDistance = 0;
        const startTime = new Date(locations[0].time);
        const endTime = new Date(locations[locations.length - 1].time);
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));

        for (let i = 0; i < locations.length - 1; i++) {
            totalDistance += getDistance(
                locations[i].lat, locations[i].lng,
                locations[i + 1].lat, locations[i + 1].lng
            );
        }
        const totalKm = (totalDistance / 1000).toFixed(2);

        // 3. Prepare prompt for Gemini
        const prompt = `
      당신은 독거 노인을 돌보는 따뜻하고 친절한 AI '안심이'입니다. 
      보호자에게 어르신의 오늘 활동 내용을 요약해서 안심시켜 드리는 보고서를 작성해주세요.
      
      [어르신 활동 데이터]
      - 총 이동 거리: ${totalKm} km
      - 활동 감지 시간: 약 ${durationMinutes}분
      - 시작 시간: ${startTime.toLocaleString('ko-KR')}
      - 종료 시간: ${endTime.toLocaleString('ko-KR')}
      - 방문 기록 수: ${locations.length}개
      
      [지시사항]
      1. 한국어로 작성하세요.
      2. 말투는 정중하고 부드럽게, "어머님/아버님이 오늘 ~하셨습니다" 같은 톤으로 작성하세요.
      3. 이동 거리가 0.5km 미만이면 "오늘은 댁에서 주로 쉬셨습니다" 라고 표현하고, 그 이상이면 산책이나 외출을 하신 것으로 표현하세요.
      4. 전체 길이는 3~4문장으로 핵심만 요약하세요.
      5. 마지막에는 보호자에게 전하는 안부 인사 한마디를 덧붙이세요.
    `;

        // 4. Call Gemini API
        console.log("AI Service: Ready to call Gemini");
        console.log("AI Service: Prompt length:", prompt.length);
        console.log("AI Service: Key exists?", !!process.env.GEMINI_API_KEY);

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is missing in environment variables.");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        console.log("AI Service: Requesting generation...");

        const result = await model.generateContent(prompt);
        console.log("AI Service: Generation complete. Getting response...");

        const response = await result.response;
        const text = response.text();
        console.log("AI Service: Success! Response length:", text.length);

        return text;

    } catch (error) {
        console.error("AI Summary Generation Error Details:", error);
        // Log the full error object to see checking quotas or validation errors
        if (error.response) {
            console.error("Gemini API Error Response:", await error.response.text());
        }
        throw new Error("AI 요약 생성 중 오류가 발생했습니다: " + error.message);
    }
}

module.exports = {
    generateDailySummary
};
