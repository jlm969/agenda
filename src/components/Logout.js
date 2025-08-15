import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase'; // ✅ VERIFICA que la ruta a tu archivo firebase sea correcta

const Logout = () => {
 const handleLogout = async () => {
  try {
   await signOut(auth);
   // La función `onAuthStateChanged` en App.js detectará
   // que el usuario ha cerrado sesión y volverá a la pantalla de login.
  } catch (error) {
   console.error("Error al cerrar sesión: ", error);
  }
 };

 return (
  <button
   onClick={handleLogout}
   className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
  >
   Cerrar Sesión
  </button>
 );
};

export default Logout;