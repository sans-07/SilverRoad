require('dotenv').config();
const admin = require('firebase-admin');

// Service Account setup (copied from index.js logic)
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

async function check() {
    console.log("Checking guardian...");
    const guardians = await db.collection('users').where('email', '==', 'guardian@test.com').get();
    if (guardians.empty) { console.log("Guardian not found"); return; }

    const guardian = guardians.docs[0].data();
    console.log("Guardian ID:", guardians.docs[0].id);
    console.log("Connected AnsimId:", guardian.connectedAnsimId);

    if (!guardian.connectedAnsimId) { console.log("No connected ansim."); return; }

    const locations = await db.collection('users').doc(guardian.connectedAnsimId).collection('locations').get();
    console.log("Location count for senior:", locations.size);

    if (locations.size > 0) {
        console.log("First location:", locations.docs[0].data());
    }
}

check();
