import React, { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import useCRUDModal from "../hooks/useCRUDModal";
import PatientHistoryModal from "./PatientHistoryModal";
import { useReactToPrint } from "react-to-print";
import { AiOutlinePrinter } from "react-icons/ai";

import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { db } from "../firebase";  // Ajusta la ruta según donde tengas firebase.js

// Componente para imprimir el historial clínico (igual que antes)
const PrintableHistorial = React.forwardRef(({ patient, historial }, ref) => {
  if (!patient || !historial) return null;
  return (
    <div ref={ref} className="p-8">
      {/* ... igual que antes */}
    </div>
  );
});

const Pacientes = ({
  // Ya no necesitas recibir patients, eliminar patients del props
  newPatient,
  setNewPatient,
  addOrUpdatePatient,
  editingPatientIndex,
  setEditingPatientIndex,
  filter,
  setFilter,
  editPatient,
  deletePatient,
  handlePhotoUpload,
  appointments,
  updatePatient,
}) => {
  // Estado local para pacientes desde Firestore
  const [patients, setPatients] = useState([]);

  const {
    isModalOpen,
    itemToDelete,
    openModal,
    closeModal,
    confirmDelete,
    cancelDelete
  } = useCRUDModal();

  const [treatmentHistoryModalOpen, setTreatmentHistoryModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historialClinico, setHistorialClinico] = useState({
    edad: "",
    antecedentesPersonales: "",
    antecedentesFamiliares: "",
    medicacionHabitual: "",
    alergias: "",
    observaciones: "",
  });

  const componentRef = useRef();

  // Escuchar cambios en Firestore (carga inicial y updates en tiempo real)
  useEffect(() => {
    const q = query(collection(db, "patients"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const patientsArr = [];
      querySnapshot.forEach((doc) => {
        patientsArr.push({ id: doc.id, ...doc.data() });
      });
      setPatients(patientsArr);
    });
    return () => unsubscribe();
  }, []);

  // Agregar o actualizar paciente en Firestore
  const savePatientFirestore = async () => {
    if (!newPatient.name.trim()) return;

    try {
      if (editingPatientIndex !== null) {
        // Editar: actualizar documento en Firestore
        const patientToEdit = patients[editingPatientIndex];
        const patientRef = doc(db, "patients", patientToEdit.id);
        await updateDoc(patientRef, newPatient);
      } else {
        // Nuevo paciente: agregar documento a Firestore
        await addDoc(collection(db, "patients"), newPatient);
      }
      setNewPatient({ name: "", phone: "", email: "", photo: "" });
      setEditingPatientIndex(null);
      closeModal();
    } catch (error) {
      console.error("Error saving patient in Firestore:", error);
    }
  };

  // Para editar paciente, setear índice y cargar datos en formulario
  const handleEditPatient = (index) => {
    setEditingPatientIndex(index);
    setNewPatient(patients[index]);
    openModal();
  };

  // Borrar paciente en Firestore
  const handleDeletePatient = async (index) => {
    try {
      const patientToDelete = patients[index];
      await deleteDoc(doc(db, "patients", patientToDelete.id));
      cancelDelete();
    } catch (error) {
      console.error("Error deleting patient from Firestore:", error);
    }
  };

  // Actualizar historial clínico (Firestore)
  const handleSaveHistoryFirestore = async () => {
    if (!selectedPatient) return;
    try {
      const patientRef = doc(db, "patients", selectedPatient.id);
      const updatedData = { ...selectedPatient, historialClinico };
      await updateDoc(patientRef, updatedData);
      setHistoryModalOpen(false);
      setSelectedPatient(null);
    } catch (error) {
      console.error("Error updating historial clinico:", error);
    }
  };

  // El resto del componente queda igual, excepto que ahora usamos las funciones arriba

  // Usar funciones nuevas para CRUD
  const handleSavePatient = () => {
    savePatientFirestore();
  };

  const handleConfirmDeletePatient = () => {
    if (itemToDelete !== null) {
      handleDeletePatient(itemToDelete);
    }
  };

  // Filtrado sigue igual
  const filteredPatients = patients.filter((patient) =>
    patient.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg">
      {/* ... resto del JSX igual, excepto cambiar llamadas a editPatient, deletePatient y addOrUpdatePatient
            por handleEditPatient, handleDeletePatient y handleSavePatient según corresponda */}
      {/* ... ejemplo: */}
      <button
        onClick={() => handleEditPatient(index)}
        className="bg-yellow-400 text-white px-4 py-2 rounded text-sm hover:bg-yellow-500 transition-colors flex items-center space-x-1"
      >
        {/* ... */}
        <span>Editar</span>
      </button>

      {/* Botón eliminar llama a confirmDelete que luego ejecuta handleConfirmDeletePatient */}
      <button
        onClick={() => confirmDelete(index)}
        className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors flex items-center space-x-1"
      >
        {/* ... */}
        <span>Eliminar</span>
      </button>

      {/* Modal para guardar paciente */}
      <Modal
        title={editingPatientIndex !== null ? "Editar Paciente" : "Agregar Nuevo Paciente"}
        isOpen={isModalOpen}
        onClose={closeModal}
      >
        {/* ... formulario */}
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={closeModal}
            className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSavePatient}
            className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
          >
            {editingPatientIndex !== null ? "Guardar Cambios" : "Agregar Paciente"}
          </button>
        </div>
      </Modal>

      {/* Modal historia clínica */}
      <Modal
        title={`Historia Clínica de ${selectedPatient?.name}`}
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        size="md"
      >
        {/* ... formulario igual */}
        <div className="flex justify-end mt-4">
          <button onClick={() => setHistoryModalOpen(false)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 mr-2">
            Cerrar
          </button>
          <button onClick={handleSaveHistoryFirestore} className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 mr-2">
            Guardar Cambios
          </button>
          <button
            onClick={() => { /* imprimir igual */ }}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2 transition-colors"
          >
            <AiOutlinePrinter className="h-5 w-5" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </Modal>

      {/* Resto de modals igual */}
    </div>
  );
};

export default Pacientes;
