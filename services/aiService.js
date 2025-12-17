const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getDistance, analyzeLocations } = require("./locationService");

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

        // 2. Calculate basic stats and detailed path analysis
        let totalDistance = 0;
        const startTime = new Date(locations[0].time);
        const endTime = new Date(locations[locations.length - 1].time);
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));

        // Detailed segment analysis
        const segments = [];
        let maxSpeed = 0;
        let totalSpeed = 0;
        let fastSegments = 0; // > 36 km/h (10 m/s)
        let longJumps = 0; // > 1 km in single segment

        for (let i = 0; i < locations.length - 1; i++) {
            const distance = getDistance(
                locations[i].lat, locations[i].lng,
                locations[i + 1].lat, locations[i + 1].lng
            );
            totalDistance += distance;

            // Calculate speed
            const timeDiff = (new Date(locations[i + 1].time) - new Date(locations[i].time)) / 1000; // seconds
            const speed = timeDiff > 0 ? distance / timeDiff : 0; // m/s
            const speedKmh = speed * 3.6; // km/h

            segments.push({
                distance,
                speed,
                speedKmh,
                timeDiff
            });

            totalSpeed += speed;
            maxSpeed = Math.max(maxSpeed, speedKmh);

            // Detect unusual patterns
            if (speedKmh > 36) fastSegments++;
            if (distance > 1000) longJumps++;
        }

        const totalKm = (totalDistance / 1000).toFixed(2);
        const avgSpeed = segments.length > 0 ? (totalSpeed / segments.length) * 3.6 : 0;

        // 3. Fetch and analyze safe zone
        const userDoc = await db.collection('users').doc(ansimId).get();
        const userData = userDoc.data();

        let safeZone = null;
        let safeZoneType = 'none';

        // Check for manual safe zone first
        if (userData && userData.manualSafeZone && userData.manualSafeZone.enabled) {
            safeZone = userData.manualSafeZone;
            safeZoneType = 'manual';
        } else {
            // Calculate auto safe zone
            const admin = require('firebase-admin');
            const analysisResult = await analyzeLocations(ansimId, db, admin);
            if (analysisResult.safeZone) {
                safeZone = analysisResult.safeZone;
                safeZoneType = 'auto';
            }
        }

        // Analyze safe zone violations
        let violations = 0;
        let maxViolationDistance = 0;
        let currentlyOutside = false;

        if (safeZone) {
            locations.forEach((loc, idx) => {
                const distanceFromCenter = getDistance(
                    loc.lat, loc.lng,
                    safeZone.center.lat, safeZone.center.lng
                );

                if (distanceFromCenter > safeZone.radius) {
                    violations++;
                    const violationDist = distanceFromCenter - safeZone.radius;
                    maxViolationDistance = Math.max(maxViolationDistance, violationDist);

                    // Check if last location is outside
                    if (idx === locations.length - 1) {
                        currentlyOutside = true;
                    }
                }
            });
        }

        // 4. Prepare enhanced prompt for Gemini
        const prompt = `
      당신은 독거 노인을 돌보는 따뜻하고 친절한 AI '안심이'입니다. 
      보호자에게 어르신의 오늘 활동 내용을 요약해서 안심시켜 드리는 보고서를 작성해주세요.
      
      [어르신 활동 데이터]
      - 총 이동 거리: ${totalKm} km
      - 활동 감지 시간: 약 ${durationMinutes}분
      - 시작 시간: ${startTime.toLocaleString('ko-KR')}
      - 종료 시간: ${endTime.toLocaleString('ko-KR')}
      - 방문 기록 수: ${locations.length}개
      
      [상세 이동 분석]
      - 평균 이동 속도: ${avgSpeed.toFixed(1)} km/h
      - 최대 속도: ${maxSpeed.toFixed(1)} km/h
      - 빠른 이동 구간: ${fastSegments}개 (36km/h 이상)
      - 긴 거리 점프: ${longJumps}개 (1km 이상 단번에 이동)
      
      [안심 구역 분석]
      - 안심 구역 설정: ${safeZone ? (safeZoneType === 'manual' ? '수동 설정됨' : '자동 분석됨') : '설정 안 됨'}
      - 안심 구역 이탈 횟수: ${violations}회
      - 최대 이탈 거리: ${maxViolationDistance > 0 ? maxViolationDistance.toFixed(0) + 'm' : '없음'}
      - 현재 위치: ${currentlyOutside ? '⚠️ 안심 구역 밖' : '안심 구역 안'}
      
      [지시사항]
      1. 한국어로 작성하세요.
      2. 말투는 정중하고 부드럽게, "어머님/아버님이 오늘 ~하셨습니다" 같은 톤으로 작성하세요.
      3. 이동 거리가 0.5km 미만이면 "오늘은 댁에서 주로 쉬셨습니다" 라고 표현하고, 그 이상이면 산책이나 외출을 하신 것으로 표현하세요.
      4. 최대 속도가 36km/h를 초과하면 "평소보다 빠르게 이동하신 구간이 있습니다" 또는 "차량을 이용하셨을 수 있습니다"라고 부드럽게 언급하세요.
      5. 긴 거리 점프가 있으면 "평소보다 먼 거리를 한 번에 이동하신 것으로 보입니다"라고 표현하세요.
      6. 안심 구역 이탈이 있으면 "안심 구역을 벗어나신 적이 있습니다"라고 언급하세요.
      7. 현재 안심 구역 밖에 계시면 "⚠️ 현재 안심 구역 밖에 계십니다"라고 명확히 알려주세요.
      8. 이탈 거리가 500m 이상이면 "평소 활동 범위보다 상당히 멀리 가셨습니다"라고 표현하세요.
      9. **중요:** 여러 이상 패턴이 동시에 관측되면 (빠른 속도 + 안심 구역 이탈 등) "이상 행동이 관측되어 위험할 수 있으니 확인이 필요합니다"라는 경고를 반드시 포함하세요.
      10. 우려사항이 있어도 기본적으로는 따뜻하고 안심시키는 톤을 유지하되, 위험 신호가 명확하면 보호자가 조치를 취할 수 있도록 분명히 전달하세요.
      11. 전체 길이는 4~6문장으로 핵심만 요약하세요.
      12. 마지막에는 보호자에게 전하는 안부 인사 한마디를 덧붙이세요.
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
