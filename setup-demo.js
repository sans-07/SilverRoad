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

    // 3. Add Dummy Locations (Today)
    const locationsRef = seniorRef.collection('locations');
    const now = new Date();
    // Generate a path: walk in a circle
    for (let i = 0; i < 20; i++) {
        const time = new Date(now.getTime() - (20 - i) * 60 * 1000); // Past 20 minutes
        // Base coord (Seoul City Hall)
        const lat = 37.5665 + (Math.sin(i * 0.5) * 0.002);
        const lng = 126.9780 + (Math.cos(i * 0.5) * 0.002);

        await locationsRef.add({
            lat, lng,
            time: time.toISOString()
        });
    }
    console.log("Added 20 dummy location points.");

    // 4. Link Guardian to Senior
    await guardianRef.update({
        connectedAnsimId: seniorId
    });
    console.log("Linked Guardian to Senior.");
    console.log("✅ Setup Complete! Refresh the browser.");
}

setup();
