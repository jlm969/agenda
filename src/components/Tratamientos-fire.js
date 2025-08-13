import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import useCRUDModal from "../hooks/useCRUDModal";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

function Tratamientos() {
  // Estado local de tratamientos y nuevo tratamiento
  const [treatments, setTreatments] = useState([]);
  const [newTreatment, setNewTreatment] = useState({ name: "", description: "", price: "", duration: "" });
  const [editingTreatmentIndex, setEditingTreatmentIndex] = useState(null);

  // Hook para modal de agregar/editar y confirmación eliminar
  const { isModalOpen, itemToDelete, openModal, closeModal, confirmDelete, cancelDelete } = useCRUDModal();

  // Colección Firestore
  const treatmentsCollection = collection(db, "treatments");

  // Cargar tratamientos desde Firestore al montar el componente
  useEffect(() => {
    const fetchTreatments = async () => {
      try {
        const snapshot = await getDocs(treatmentsCollection);
        const treatmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTreatments(treatmentsData);
      } catch (error) {
        console.error("Error al cargar tratamientos:", error);
      }
    };

    fetchTreatments();
  }, []);

  // Abrir modal agregar
  const openAddModal = () => {
    setNewTreatment({ name: "", description: "", price: "", duration: "" });
    setEditingTreatmentIndex(null);
    openModal();
  };

  // Abrir modal editar
  const openEditModal = (index) => {
    setEditingTreatmentIndex(index);
    setNewTreatment(treatments[index]);
    openModal();
  };

  // Guardar o actualizar tratamiento en Firestore
  const addOrUpdateTreatment = async () => {
    if (!newTreatment.name.trim()) {
      alert("El nombre del tratamiento es obligatorio.");
      return;
    }

    try {
      if (editingTreatmentIndex !== null) {
        // Actualizar tratamiento
        const treatmentToUpdate = treatments[editingTreatmentIndex];
        const docRef = doc(db, "treatments", treatmentToUpdate.id);
        await updateDoc(docRef, {
          name: newTreatment.name,
          description: newTreatment.description,
          price: newTreatment.price,
          duration: newTreatment.duration
        });

        // Actualizar estado local
        const updatedTreatments = [...treatments];
        updatedTreatments[editingTreatmentIndex] = { ...treatmentToUpdate, ...newTreatment };
        setTreatments(updatedTreatments);

      } else {
        // Agregar nuevo tratamiento
        const docRef = await addDoc(treatmentsCollection, newTreatment);
        setTreatments([...treatments, { id: docRef.id, ...newTreatment }]);
      }
      closeModal();
    } catch (error) {
      console.error("Error al guardar tratamiento:", error);
    }
  };

  // Eliminar tratamiento de Firestore
  const deleteTreatment = async (index) => {
    try {
      const treatmentToDelete = treatments[index];
      await deleteDoc(doc(db, "treatments", treatmentToDelete.id));
      const updatedTreatments = treatments.filter((_, i) => i !== index);
      setTreatments(updatedTreatments);
    } catch (error) {
      console.error("Error al eliminar tratamiento:", error);
    }
    cancelDelete();
  };

  // Confirmar eliminación
  const handleConfirmDelete = () => {
    if (itemToDelete !== null) {
      deleteTreatment(itemToDelete);
    }
  };

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
            className="border p-3 rounded w-full"
            value={newTreatment.name}
            onChange={(e) => setNewTreatment({ ...newTreatment, name: e.target.value })}
          />
          <textarea
            placeholder="Descripción"
            className="border p-3 rounded w-full"
            value={newTreatment.description}
            onChange={(e) => setNewTreatment({ ...newTreatment, description: e.target.value })}
          />
          <input
            type="number"
            placeholder="Precio"
            className="border p-3 rounded w-full"
            value={newTreatment.price}
            onChange={(e) => setNewTreatment({ ...newTreatment, price: e.target.value })}
          />
          <input
            type="text"
            placeholder="Duración (ej: 60 min)"
            className="border p-3 rounded w-full"
            value={newTreatment.duration}
            onChange={(e) => setNewTreatment({ ...newTreatment, duration: e.target.value })}
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
            onClick={addOrUpdateTreatment}
          >
            {editingTreatmentIndex !== null ? "Actualizar Tratamiento" : "Agregar Tratamiento"}
          </button>
        </div>
      </Modal>

      <ul className="mt-6 space-y-3 max-h-[70vh] overflow-y-auto">
        {treatments.map((t, i) => (
          <li key={t.id} className="bg-gray-50 p-4 rounded-xl shadow-md border border-gray-200 flex justify-between items-center">
            <div>
              <div className="font-bold text-lg text-pink-800">{t.name}</div>
              <div className="text-sm text-gray-700">{t.description}</div>
              <div className="text-sm text-gray-700">Precio: ${t.price} | Duración: {t.duration}</div>
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
        <p>¿Estás seguro de que quieres eliminar este tratamiento? Esta acción no se puede deshacer.</p>
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

export default Tratamientos;
