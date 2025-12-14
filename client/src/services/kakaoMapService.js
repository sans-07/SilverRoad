const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;

export const kakaoMapService = {
    fetchRoute: async (origin, destination, waypoints = []) => {
        if (!KAKAO_API_KEY) {
            console.error("Kakao API Key is missing!");
            return null;
        }

        const url = "https://apis-navi.kakaomobility.com/v1/directions";

        // Format coordinates as "lng,lat" string
        const originStr = `${origin.lng},${origin.lat}`;
        const destinationStr = `${destination.lng},${destination.lat}`;

        const params = new URLSearchParams({
            origin: originStr,
            destination: destinationStr,
            priority: "RECOMMEND", // or TIME, DISTANCE
        });

        if (waypoints.length > 0) {
            const waypointsStr = waypoints.map(p => `${p.lng},${p.lat}`).join('|');
            params.append('waypoints', waypointsStr);
        }

        try {
            const response = await fetch(`${url}?${params.toString()}`, {
                method: "GET",
                headers: {
                    "Authorization": `KakaoAK ${KAKAO_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`Kakao API Error: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const path = [];

                if (!route.sections) {
                    console.warn("Kakao API: No sections found in route");
                    return null;
                }

                // Extract coordinates from sections -> roads -> vertexes
                route.sections.forEach(section => {
                    if (!section.roads) return;
                    section.roads.forEach(road => {
                        if (!road.vertexes) return;
                        for (let i = 0; i < road.vertexes.length; i += 2) {
                            path.push({
                                lng: road.vertexes[i],
                                lat: road.vertexes[i + 1]
                            });
                        }
                    });
                });

                return path;
            }

            return null;

        } catch (error) {
            console.error("Failed to fetch route:", error);
            return null;
        }
    }
};
