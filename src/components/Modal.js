// Modal.js

import React from 'react';

const Modal = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    // El contenedor permite scroll y el panel usa m-auto: queda centrado si entra
    // en pantalla y, si es más alto que la pantalla, se puede recorrer completo.
    <div className="fixed inset-0 z-50 flex p-4 bg-gray-900/40 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className="relative m-auto p-5 sm:p-6 bg-white w-full max-w-lg rounded-2xl shadow-2xl"
      >
        <div className="flex justify-between items-center gap-3 pb-3 border-b border-gray-200">
          <h3 className="text-2xl sm:text-3xl font-semibold text-pink-700">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-bold"
          >
            &times;
          </button>
        </div>
        <div className="my-5">
          {children}
        </div>
        {/* Los botones pasan a la fila siguiente cuando no entran. Si el modal trae sus propios botones, no se dibuja la barra vacía. */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-gray-200">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-semibold transition-colors ${action.className || 'bg-pink-500 text-white hover:bg-pink-600'}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
