// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD94Esmqx3-skdshH8AZGMyebsDcCbjGDQ",
  authDomain: "agenda-lh-app.firebaseapp.com",
  projectId: "agenda-lh-app",
  storageBucket: "agenda-lh-app.firebasestorage.app",
  messagingSenderId: "650467753545",
  appId: "1:650467753545:web:e69d315622f07cfa498998"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore (base de datos)
const db = getFirestore(app);

export { db };
