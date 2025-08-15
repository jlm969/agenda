// Importa las funciones de Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración de tu app (la que ya me pasaste)
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

// Inicializar Firestore
const db = getFirestore(app);

// Obtener la instancia de autenticaci
const auth = getAuth(app);
export { db, auth };



