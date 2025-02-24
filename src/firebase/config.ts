// Import des fonctions Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';

// Vérifier si le module `firebase/analytics` est compatible avec le web
let analytics;
if (typeof window !== "undefined") {
    import("firebase/analytics").then(({ getAnalytics }) => {
        analytics = getAnalytics(app);
    });
}

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAeej6PhMqcvclMz4AxR0J7lZGQIFOZHds",
    authDomain: "jardinsdecocagne-2ef75.firebaseapp.com",
    projectId: "jardinsdecocagne-2ef75",
    storageBucket: "jardinsdecocagne-2ef75.appspot.com", // ✅ Correction ici
    messagingSenderId: "604099059425",
    appId: "1:604099059425:web:437ac2d66a28012e9b61a0",
    measurementId: "G-5S9JHZEWLL"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
