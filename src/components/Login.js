import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const Login = () => {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');

 const handleLogin = async (e) => {
  e.preventDefault();
  setError('');

  try {
   await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
   if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
    setError('Email o contraseña incorrectos.');
   } else {
    setError('Ocurrió un error. Por favor, inténtalo más tarde.');
   }
  }
 };

 return (
  <div className="p-0">
   {/* Título eliminado de aquí */}
   <form onSubmit={handleLogin} className="space-y-2">
    <div>
     <label className="block text-sm font-medium text-gray-700">Email</label>
     <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      required
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
     />
    </div>
    <div>
     <label className="block text-sm font-medium text-gray-700">Contraseña</label>
     <input
      type="password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
     />
    </div>
    {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    <div>
     <button
      type="submit"
      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
     >
      Iniciar Sesión
     </button>
    </div>
   </form>
  </div>
 );
};

export default Login;