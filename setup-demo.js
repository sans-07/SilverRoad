require('dotenv').config();
const admin = require('firebase-admin');

// Service Account setup
let serviceAccount;
const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY_PATH;
if (!serviceAccountPath) { console.error("No service account path"); process.exit(1); }
serviceAccount = require(serviceAccountPath);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function setup() {
    console.log("Setting up demo data...");
    const guardianEmail = 'guardian@test.com';

    // 1. Find Guardian
    const guardians = await db.collection('users').where('email', '==', guardianEmail).get();
    if (guardians.empty) { console.log("Guardian not found! Please sign up first."); return; }
    const guardianRef = guardians.docs[0].ref;
    console.log("Found Guardian:", guardians.docs[0].id);

    // 2. Create/Find Link Code for Senior (Simulated)
    // Let's just create a senior doc directly
    const seniorId = 'demo-senior-' + Date.now();
    const seniorRef = db.collection('users').doc(seniorId);

    await seniorRef.set({
        email: 'senior@demo.com',
        name: '김철수 어르신',
        isAnsim: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Created Senior:", seniorId);

    // 3. Add Dummy Locations with Various Patterns (Today)
    const locationsRef = seniorRef.collection('locations');
    const now = new Date();

    // Scenario: Mix of normal walking, fast movement, and long jump
    const testLocations = [];

    // Part 1: Normal walking (5 points, ~5 km/h)
    for (let i = 0; i < 5; i++) {
        const time = new Date(now.getTime() - (30 - i * 2) * 60 * 1000); // 2 min intervals
        const lat = 37.5665 + (i * 0.0005); // ~55m per step
        const lng = 126.9780 + (i * 0.0005);
        testLocations.push({ lat, lng, time: time.toISOString() });
    }

    // Part 2: Fast movement - simulate vehicle (3 points, ~50 km/h)
    for (let i = 0; i < 3; i++) {
        const time = new Date(now.getTime() - (20 - i * 2) * 60 * 1000); // 2 min intervals
        const lat = 37.5665 + 0.0025 + (i * 0.005); // ~550m per step (fast!)
        const lng = 126.9780 + 0.0025 + (i * 0.005);
        testLocations.push({ lat, lng, time: time.toISOString() });
    }

    // Part 3: Long jump - sudden 2km move (simulating GPS error or taxi)
    testLocations.push({
        lat: 37.5665 + 0.02, // ~2.2 km jump
        lng: 126.9780 + 0.02,
        time: new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    });

    // Part 4: Return to normal walking (5 points)
    for (let i = 0; i < 5; i++) {
        const time = new Date(now.getTime() - (8 - i) * 60 * 1000); // 1 min intervals
        const lat = 37.5665 + 0.02 + (i * 0.0003);
        const lng = 126.9780 + 0.02 + (i * 0.0003);
        testLocations.push({ lat, lng, time: time.toISOString() });
    }

    // Add all locations to Firestore
    for (const loc of testLocations) {
        await locationsRef.add(loc);
    }
    console.log(`Added ${testLocations.length} test location points with various patterns.`);

    // 4. Set up a manual safe zone (centered around starting point, 500m radius)
    // This will make the long jump and some fast movements trigger violations
    await seniorRef.update({
        manualSafeZone: {
            center: {
                lat: 37.5665,
                lng: 126.9780
            },
            radius: 500, // 500 meters
            enabled: true
        }
    });
    console.log("Created manual safe zone (500m radius).");

    // 5. Link Guardian to Senior
    await guardianRef.update({
        connectedAnsimId: seniorId
    });
    console.log("Linked Guardian to Senior.");
    console.log("✅ Setup Complete! Refresh the browser.");
}

setup();
