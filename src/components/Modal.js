import React from 'react';

const Modal = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl mx-4 md:mx-0 flex flex-col animate-fadeIn max-h-[80vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3 px-6 pt-4">
          <h2 className="text-xl font-semibold text-pink-600">{title}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 font-bold text-xl"
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {children}
        </div>

        {/* Footer / Acciones */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 border-t px-6 py-4">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`${action.className || 'bg-pink-500 text-white'} px-4 py-2 rounded flex items-center gap-2 hover:opacity-90 transition`}
              >
                {action.icon && <span className="text-lg">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Animación */}
      <style>
        {`
          @keyframes fadeIn {
            from {opacity:0; transform: translateY(-10px);}
            to {opacity:1; transform: translateY(0);}
          }
          .animate-fadeIn {
            animation: fadeIn 0.2s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default Modal;
