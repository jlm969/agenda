import React, { useState } from 'react';
import Modal from './Modal';
import useCRUDModal from '../hooks/useCRUDModal';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const tratamientosRef = collection(db, "tratamientos");

const EMPTY_TREATMENT = { name: "", description: "", price: "", duration: "" };

// Los tratamientos llegan desde App.js (ya cargados en tiempo real)
function Tratamientos({ treatments = [] }) {
  const [newTreatment, setNewTreatment] = useState(EMPTY_TREATMENT);
  const [editingTreatmentIndex, setEditingTreatmentIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const { isModalOpen, itemToDelete, openModal, closeModal, confirmDelete, cancelDelete } = useCRUDModal();

  const openAddModal = () => {
    setNewTreatment(EMPTY_TREATMENT);
    setEditingTreatmentIndex(null);
    openModal();
  };

  const openEditModal = (index) => {
    setEditingTreatmentIndex(index);
    // Los tratamientos viejos pueden no tener todos los campos: se completan vacíos
    setNewTreatment({ ...EMPTY_TREATMENT, ...treatments[index] });
    openModal();
  };

  const addOrUpdateTreatment = async () => {
    // El id es del documento, no se guarda como un dato más
    const { id, ...data } = newTreatment;
    if (editingTreatmentIndex !== null) {
      const treatment = treatments[editingTreatmentIndex];
      await updateDoc(doc(db, "tratamientos", treatment.id), data);
    } else {
      await addDoc(tratamientosRef, data);
    }
    closeModal();
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete === null) return;
    try {
      const treatment = treatments[itemToDelete];
      await deleteDoc(doc(db, "tratamientos", treatment.id));
      cancelDelete();
    } catch (error) {
      console.error("Error al eliminar el tratamiento:", error);
      alert("No se pudo eliminar. Revisá tu conexión e intentá de nuevo.");
    }
  };

  const handleSaveTreatment = async () => {
    if (String(newTreatment.name || "").trim() === "") {
      alert("El nombre del tratamiento es obligatorio.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await addOrUpdateTreatment();
    } catch (error) {
      console.error("Error al guardar el tratamiento:", error);
      alert("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  return (
    <div>
      <h2 className="text-2xl font-semibold text-pink-600 mb-4">Tratamientos</h2>
      <button
        onClick={openAddModal}
        className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition mb-4 flex items-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        <span>Agregar Nuevo Tratamiento</span>
      </button>

      <Modal
        title={editingTreatmentIndex !== null ? "Editar Tratamiento" : "Agregar Tratamiento"}
        isOpen={isModalOpen}
        onClose={closeModal}
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nombre del tratamiento"
            aria-label="Nombre"
            className="border p-3 rounded w-full"
            value={newTreatment.name}
            onChange={(e) => setNewTreatment({ ...newTreatment, name: e.target.value })}
          />
          <textarea
            placeholder="Descripción"
            aria-label="Descripción"
            className="border p-3 rounded w-full"
            value={newTreatment.description}
            onChange={(e) => setNewTreatment({ ...newTreatment, description: e.target.value })}
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Precio"
            aria-label="Precio"
            className="border p-3 rounded w-full"
            value={newTreatment.price}
            onChange={(e) => setNewTreatment({ ...newTreatment, price: e.target.value })}
          />
          <input
            type="text"
            placeholder="Duración (ej: 60 min)"
            aria-label="Duración"
            className="border p-3 rounded w-full"
            value={newTreatment.duration}
            onChange={(e) => setNewTreatment({ ...newTreatment, duration: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="bg-gray-300 text-gray-700 px-4 sm:px-6 py-2 rounded hover:bg-gray-400 transition"
            onClick={closeModal}
          >
            Cancelar
          </button>
          <button
            className="bg-pink-500 text-white px-4 sm:px-6 py-2 rounded hover:bg-pink-600 transition"
            onClick={handleSaveTreatment}
          >
            {editingTreatmentIndex !== null ? "Actualizar Tratamiento" : "Agregar Tratamiento"}
          </button>
        </div>
      </Modal>

      <ul className="mt-6 space-y-3 max-h-[70vh] overflow-y-auto">
        {treatments.map((t, i) => {
          const details = [
            hasValue(t.price) ? `Precio: $${t.price}` : "",
            hasValue(t.duration) ? `Duración: ${t.duration}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
          return (
            <li
              key={t.id}
              className="bg-gray-50 p-4 rounded-xl shadow-md border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-bold text-lg text-pink-800">{t.name}</div>
                {t.description && <div className="text-sm text-gray-700">{t.description}</div>}
                {details && <div className="text-sm text-gray-700">{details}</div>}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex shrink-0">
                <button
                  className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center justify-center space-x-1"
                  onClick={() => openEditModal(i)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span>Editar</span>
                </button>
                <button
                  className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center justify-center space-x-1"
                  onClick={() => confirmDelete(i)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Eliminar</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal title="Confirmar Eliminación" isOpen={itemToDelete !== null} onClose={cancelDelete}>
        <p>¿Estás seguro de que quieres eliminar este tratamiento? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="bg-gray-300 text-gray-700 px-4 sm:px-6 py-2 rounded hover:bg-gray-400 transition"
            onClick={cancelDelete}
          >
            Cancelar
          </button>
          <button
            className="bg-red-500 text-white px-4 sm:px-6 py-2 rounded hover:bg-red-600 transition"
            onClick={handleConfirmDelete}
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default Tratamientos;
