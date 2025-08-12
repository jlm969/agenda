import React from 'react';
import Modal from './Modal';
import useCRUDModal from '../hooks/useCRUDModal';

function Consultorios({ consultorios, newConsultorio, setNewConsultorio, addOrUpdateConsultorio, editingConsultorioIndex, editConsultorio, deleteConsultorio }) {
  const { isModalOpen, itemToDelete, openModal, closeModal, confirmDelete, cancelDelete } = useCRUDModal();

  const openAddModal = () => {
    setNewConsultorio({ name: "", address: "", city: "", phone: "" });
    openModal();
  };

  const openEditModal = (index) => {
    editConsultorio(index);
    openModal();
  };

  const handleConfirmDelete = () => {
    if (itemToDelete !== null) {
      deleteConsultorio(itemToDelete);
      cancelDelete();
    }
  };

  const handleSaveConsultorio = () => {
    if (newConsultorio.name.trim() === "") {
        alert("El nombre del consultorio es obligatorio.");
        return;
    }
    addOrUpdateConsultorio();
    closeModal();
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-pink-600 mb-4">Consultorios</h2>
      <button
        onClick={openAddModal}
        className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition mb-4 flex items-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        <span>Agregar Nuevo Consultorio</span>
      </button>

      <Modal
        title={editingConsultorioIndex !== null ? "Editar Consultorio" : "Agregar Consultorio"}
        isOpen={isModalOpen}
        onClose={closeModal}
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nombre del consultorio"
            className="border p-3 rounded w-full"
            value={newConsultorio.name}
            onChange={(e) => setNewConsultorio({ ...newConsultorio, name: e.target.value })}
          />
          <input
            type="text"
            placeholder="Dirección"
            className="border p-3 rounded w-full"
            value={newConsultorio.address}
            onChange={(e) => setNewConsultorio({ ...newConsultorio, address: e.target.value })}
          />
          <input
            type="text"
            placeholder="Localidad"
            className="border p-3 rounded w-full"
            value={newConsultorio.city}
            onChange={(e) => setNewConsultorio({ ...newConsultorio, city: e.target.value })}
          />
          <input
            type="text"
            placeholder="Teléfono"
            className="border p-3 rounded w-full"
            value={newConsultorio.phone}
            onChange={(e) => setNewConsultorio({ ...newConsultorio, phone: e.target.value })}
          />
        </div>
        <div className="flex justify-end mt-4">
          <button
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 transition mr-2"
            onClick={closeModal}
          >
            Cancelar
          </button>
          <button
            className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
            onClick={handleSaveConsultorio}
          >
            {editingConsultorioIndex !== null ? "Actualizar Consultorio" : "Agregar Consultorio"}
          </button>
        </div>
      </Modal>

      <ul className="mt-6 space-y-3">
        {consultorios.map((c, i) => (
          <li key={i} className="bg-gray-50 p-4 rounded-xl shadow-md border border-gray-200 flex justify-between items-center">
            <div>
              <div className="font-bold text-lg text-pink-800">{c.name}</div>
              <div className="text-sm text-gray-700">
                {c.address}
                {c.city && `, ${c.city}`}
              </div>
              {c.phone && <div className="text-sm text-gray-700">{c.phone}</div>}
            </div>
            <div className="mt-2 flex items-center">
              <button
                className="bg-yellow-400 text-white px-4 py-2 rounded text-sm mr-2 hover:bg-yellow-500 transition flex items-center space-x-1"
                onClick={() => openEditModal(i)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                <span>Editar</span>
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition flex items-center space-x-1"
                onClick={() => confirmDelete(i)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Eliminar</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Modal title="Confirmar Eliminación" isOpen={itemToDelete !== null} onClose={cancelDelete}>
        <p>¿Estás seguro de que quieres eliminar este consultorio? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end mt-4">
          <button
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 transition mr-2"
            onClick={cancelDelete}
          >
            Cancelar
          </button>
          <button
            className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition"
            onClick={handleConfirmDelete}
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default Consultorios;