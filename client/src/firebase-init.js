import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/messaging'; // Import Messaging

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // if already initialized, use that one
}

// Get Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

let messaging;
try {
  if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (error) {
  console.error("Firebase Messaging not supported:", error);
}

// Helper to register SW with config and get token
const getFcmToken = async () => {
  if (!messaging) return null;

  try {
    if ('serviceWorker' in navigator) {
      // Unregister any existing service workers to ensure clean state with new params
      // Optional but good for debugging if old broken SW persists
      // const registrations = await navigator.serviceWorker.getRegistrations();
      // for(let registration of registrations) {
      //      // Check if it's our sw
      // }

      const params = new URLSearchParams({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
      });

      const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
      console.log('Service Worker registered with config', registration);

      // Wait for the service worker to be active (optional, but helps stability)
      await navigator.serviceWorker.ready;

      // Pass the registration to getToken to avoid default SW fetch without params
      const token = await messaging.getToken({
        serviceWorkerRegistration: registration,
        vapidKey: "" // Add your VAPID key here if you generated one in Firebase Console -> Project Settings -> Cloud Messaging
      });

      return token;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    throw error;
  }
  return null;
};

// For debugging in console
window.firebase = firebase;

// Export the services
export { auth, db, firebase, messaging, getFcmToken };
