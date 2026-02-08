import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = () =>
  Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
  );

const isConfigured = isFirebaseConfigured();

let cachedApp: FirebaseApp | null = null;
let emulatorConnected = false;
let analyticsPromise: Promise<Analytics | null> | null = null;

export const getFirebaseApp = () => {
  if (!isConfigured) {
    throw new Error("Firebase config is missing. Check your .env.local values.");
  }
  if (cachedApp) return cachedApp;
  const existing = getApps();
  cachedApp = existing.length ? existing[0] : initializeApp(firebaseConfig);
  return cachedApp;
};

export const getFirebaseAuth = () => {
  const auth = getAuth(getFirebaseApp());
  return auth;
};

export const getFirebaseDb = () => getFirestore(getFirebaseApp());

export const getFirebaseAnalytics = () => {
  if (analyticsPromise) return analyticsPromise;
  analyticsPromise = (async () => {
    if (!firebaseConfig.measurementId) return null;
    if (!(await isSupported())) return null;
    return getAnalytics(getFirebaseApp());
  })();
  return analyticsPromise;
};

export const logPageView = async (path?: string) => {
  const analytics = await getFirebaseAnalytics();
  if (!analytics) return;
  const pagePath = path ?? window.location.pathname + window.location.search;
  logEvent(analytics, "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const connectEmulators = () => {
  if (emulatorConnected) return;
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "true") return;

  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  emulatorConnected = true;
};
