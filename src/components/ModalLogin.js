import React from 'react';
import logo from '../assets/lh_estetica.png';

// Pantalla de inicio de sesión: logo y nombre arriba, y la tarjeta con el formulario.
// Si se pasa onClose se muestra la "x" para cerrar; si no, no se muestra (no hay a dónde volver sin iniciar sesión).
const ModalLogin = ({ isOpen, onClose, title, children }) => {
 if (!isOpen) return null;

 return (
  <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
   <div className="w-full max-w-sm">
    <div className="text-center mb-6">
     <img src={logo} alt="Logo LH" className="w-16 mx-auto mb-3" />
     <h1 className="text-3xl font-semibold text-gray-900">Liset Herzog</h1>
     <p className="mt-1 text-[11px] tracking-[0.2em] uppercase text-gray-500">Medicina Estética</p>
    </div>

    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
     <div className="flex justify-between items-center pb-3 border-b border-gray-200">
      <h2 className="text-2xl font-semibold text-pink-700">{title}</h2>
      {onClose && (
       <button
        onClick={onClose}
        aria-label="Cerrar"
        className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-bold"
       >
        &times;
       </button>
      )}
     </div>
     <div className="mt-5">
      {children}
     </div>
    </div>
   </div>
  </main>
 );
};

export default ModalLogin;
