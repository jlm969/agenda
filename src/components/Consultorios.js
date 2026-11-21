import React, { useState } from 'react';
import Modal from './Modal';
import useCRUDModal from '../hooks/useCRUDModal';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const consultoriosRef = collection(db, "consultorios");

const EMPTY_CONSULTORIO = { name: "", address: "", city: "", province: "", mapsUrl: "", phone: "" };

// Dirección completa: calle y número, localidad y provincia (solo lo que esté cargado)
const buildAddress = (c) =>
  [c.address, c.city, c.province]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");

// Link de Google Maps: el que se haya pegado, o uno armado con la dirección
const buildMapsUrl = (c) => {
  const custom = String(c.mapsUrl || "").trim();
  if (custom) return custom;
  const address = buildAddress(c);
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Argentina`)}`
    : "";
};

// Los consultorios llegan desde App.js (ya cargados en tiempo real)
function Consultorios({ consultorios = [] }) {
  const [newConsultorio, setNewConsultorio] = useState(EMPTY_CONSULTORIO);
  const [editingConsultorioIndex, setEditingConsultorioIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const { isModalOpen, itemToDelete, openModal, closeModal, confirmDelete, cancelDelete } = useCRUDModal();

  const openAddModal = () => {
    setNewConsultorio(EMPTY_CONSULTORIO);
    setEditingConsultorioIndex(null);
    openModal();
  };

  const openEditModal = (index) => {
    setEditingConsultorioIndex(index);
    // Los consultorios viejos pueden no tener provincia ni link: se completan vacíos
    setNewConsultorio({ ...EMPTY_CONSULTORIO, ...consultorios[index] });
    openModal();
  };

  const addOrUpdateConsultorio = async () => {
    // El id es del documento, no se guarda como un dato más
    const { id, ...data } = newConsultorio;
    if (editingConsultorioIndex !== null) {
      const consultorio = consultorios[editingConsultorioIndex];
      await updateDoc(doc(db, "consultorios", consultorio.id), data);
    } else {
      await addDoc(consultoriosRef, data);
    }
    closeModal();
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete === null) return;
    try {
      const consultorio = consultorios[itemToDelete];
      await deleteDoc(doc(db, "consultorios", consultorio.id));
      cancelDelete();
    } catch (error) {
      console.error("Error al eliminar el consultorio:", error);
      alert("No se pudo eliminar. Revisá tu conexión e intentá de nuevo.");
    }
  };

  const handleSaveConsultorio = async () => {
    if (newConsultorio.name.trim() === "") {
      alert("El nombre del consultorio es obligatorio.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await addOrUpdateConsultorio();
    } catch (error) {
      console.error("Error al guardar el consultorio:", error);
      alert("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
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
            placeholder="Nombre del consultorio (el lugar, ej. FisioMed)"
            className="border p-3 rounded w-full"
            value={newConsultorio.name}
            onChange={(e) => setNewConsultorio({ ...newConsultorio, name: e.target.value })}
          />
          <input
            type="text"
            placeholder="Dirección (calle y número)"
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
            placeholder="Provincia"
            className="border p-3 rounded w-full"
            value={newConsultorio.province}
            onChange={(e) => setNewConsultorio({ ...newConsultorio, province: e.target.value })}
          />
          <div>
            <input
              type="url"
              placeholder="Link de Google Maps (opcional)"
              className="border p-3 rounded w-full"
              value={newConsultorio.mapsUrl}
              onChange={(e) => setNewConsultorio({ ...newConsultorio, mapsUrl: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Si lo dejás vacío, el link se arma solo con la dirección. Para uno exacto, en Google Maps buscá el lugar,
              tocá Compartir y pegá el link acá.
            </p>
          </div>
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

      <ul className="mt-6 space-y-3 max-h-[70vh] overflow-y-auto">
        {consultorios.map((c, i) => {
          const address = buildAddress(c);
          const mapsUrl = buildMapsUrl(c);
          return (
            <li key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <div className="font-bold text-lg text-pink-800">{c.name}</div>
                {address && <div className="text-sm text-gray-700">{address}</div>}
                {c.phone && <div className="text-sm text-gray-700">{c.phone}</div>}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-pink-700 underline">
                    Ver en Maps
                  </a>
                )}
              </div>
              <div className="mt-2 flex items-center shrink-0">
                <button
                  className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium mr-2 hover:bg-gray-50 transition flex items-center space-x-1"
                  onClick={() => openEditModal(i)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span>Editar</span>
                </button>
                <button
                  className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center space-x-1"
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
