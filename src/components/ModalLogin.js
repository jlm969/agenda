import React from 'react';

const ModalLogin = ({ isOpen, onClose, title, children }) => {
 if (!isOpen) return null;

 return (
  <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
   <div className="relative p-6 bg-white w-full max-w-sm mx-auto rounded-lg shadow-xl">
    <div className="flex justify-between items-center pb-3 border-b-2 border-pink-100">
     <h3 className="text-2xl font-semibold text-pink-700">{title}</h3>
     <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-bold">
      &times;
     </button>
    </div>
    <div className="my-5">
     {children}
    </div>
   </div>
  </div>
 );
};

export default ModalLogin;