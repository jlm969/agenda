// Modal.js

import React from 'react';

const Modal = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="relative p-6 bg-white w-full max-w-lg mx-auto rounded-lg shadow-xl">
        <div className="flex justify-between items-center pb-3 border-b-2 border-pink-100">
          <h3 className="text-2xl font-semibold text-pink-700">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-bold">
            &times;
          </button>
        </div>
        <div className="my-5">
          {children}
        </div>
        <div className="flex justify-end space-x-2 pt-3 border-t-2 border-pink-100">
          {/* VERIFICACIÓN AGREGADA AQUÍ: */}
          {actions && actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${action.className || 'bg-pink-500 text-white hover:bg-pink-600'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Modal;


