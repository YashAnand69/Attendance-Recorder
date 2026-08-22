import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const customDatabaseId = (firebaseConfig as any).firestoreDatabaseId;

// Initialize Firestore with custom database ID if present and local persistent cache
export const db = customDatabaseId && customDatabaseId !== "(default)"
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, customDatabaseId)
  : initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });

export default app;
