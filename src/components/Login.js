import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const CREDENTIALS_ERROR = 'Email o contraseña incorrectos.';

// Firebase responde con distintos códigos según la versión; los de credenciales se agrupan en un solo mensaje
const ERROR_MESSAGES = {
  'auth/wrong-password': CREDENTIALS_ERROR,
  'auth/user-not-found': CREDENTIALS_ERROR,
  'auth/invalid-email': CREDENTIALS_ERROR,
  'auth/invalid-credential': CREDENTIALS_ERROR,
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
  'auth/network-request-failed': 'No hay conexión a internet. Revisá tu conexión e intentá de nuevo.',
};

const Login = () => {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);

 const handleLogin = async (e) => {
  e.preventDefault();
  if (loading) return;
  setError('');
  setLoading(true);

  try {
   await signInWithEmailAndPassword(auth, email, password);
   // Si entra bien, App.js cambia de pantalla solo
  } catch (err) {
   setError(ERROR_MESSAGES[err.code] || 'Ocurrió un error. Por favor, inténtalo más tarde.');
  } finally {
   setLoading(false);
  }
 };

 return (
  <div className="p-0">
   <form onSubmit={handleLogin} className="space-y-4">
    <div>
     <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">Email</label>
     <input
      id="login-email"
      type="email"
      autoComplete="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      required
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
     />
    </div>
    <div>
     <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Contraseña</label>
     <input
      id="login-password"
      type="password"
      autoComplete="current-password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
     />
    </div>
    {error && (
     <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 text-center">
      {error}
     </p>
    )}
    <div>
     <button
      type="submit"
      disabled={loading}
      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
     >
      {loading ? 'Ingresando...' : 'Iniciar Sesión'}
     </button>
    </div>
   </form>
  </div>
 );
};

export default Login;
