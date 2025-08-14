import React, { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import useCRUDModal from "../hooks/useCRUDModal";
import PatientHistoryModal from "./PatientHistoryModal";
import { useReactToPrint } from "react-to-print";
import { AiOutlinePrinter } from "react-icons/ai";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Componente para imprimir el historial clínico
const PrintableHistorial = React.forwardRef(({ patient, historial }, ref) => {
  if (!patient || !historial) return null;
  return (
    <div ref={ref} className="p-8">
      <h1 className="text-2xl font-bold text-center mb-6">Historial Clínico de {patient.name}</h1>
      <div className="space-y-4">
        <div className="flex items-center">
          <span className="font-semibold text-gray-700 w-1/3">Edad:</span>
          <span className="ml-2 w-2/3">{historial.edad}</span>
        </div>
        <div className="flex items-start">
          <span className="font-semibold text-gray-700 w-1/3">Antecedentes Personales:</span>
          <span className="ml-2 w-2/3 break-words">{historial.antecedentesPersonales}</span>
        </div>
        <div className="flex items-start">
          <span className="font-semibold text-gray-700 w-1/3">Antecedentes Familiares:</span>
          <span className="ml-2 w-2/3 break-words">{historial.antecedentesFamiliares}</span>
        </div>
        <div className="flex items-start">
          <span className="font-semibold text-gray-700 w-1/3">Medicación Habitual:</span>
          <span className="ml-2 w-2/3 break-words">{historial.medicacionHabitual}</span>
        </div>
        <div className="flex items-start">
          <span className="font-semibold text-gray-700 w-1/3">Alergias:</span>
          <span className="ml-2 w-2/3 break-words">{historial.alergias}</span>
        </div>
        <div className="flex items-start">
          <span className="font-semibold text-gray-700 w-1/3">Observaciones:</span>
          <p className="mt-1 w-2/3 break-words">{historial.observaciones}</p>
        </div>
      </div>
    </div>
  );
});

const Pacientes = () => {
  // ---- Estado (mismos nombres/uso que tu componente) ----
  const [patients, setPatients] = useState([]);
  const [newPatient, setNewPatient] = useState({ name: "", phone: "", email: "", photo: "" });
  const [editingPatientIndex, setEditingPatientIndex] = useState(null);
  const [filter, setFilter] = useState("");
  const [appointments] = useState([]); // Se puede sincronizar luego cuando integremos Agenda

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

  // ---- Impresión ----
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `Historial Clínico de ${selectedPatient?.name}`,
    pageStyle: `
      @page { size: A4; margin: 20mm; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
      h1 { text-align: center; margin-bottom: 20px; color: #1a202c; }
      .print-section { border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; }
      .field-label { font-weight: 600; color: #4a5568; }
      .field-value { margin-left: 8px; font-style: italic; }
    `,
  });

  // ---- onSnapshot: colección 'pacientes' (en tiempo real) ----
  useEffect(() => {
    const pacientesRef = collection(db, "pacientes");
    const unsubscribe = onSnapshot(pacientesRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPatients(data);
    });
    return () => unsubscribe();
  }, []);

  // ---- Helpers CRUD (manteniendo tu flujo y nombres) ----
  const openAddPatientModal = () => {
    setNewPatient({ name: "", phone: "", email: "", photo: "" });
    setEditingPatientIndex(null);
    openModal();
  };

  const editPatient = (index) => {
    setEditingPatientIndex(index);
    setNewPatient(patients[index]);
  };

  const openEditPatientModal = (index) => {
    editPatient(index);
    openModal();
  };

  const addOrUpdatePatient = async () => {
    const pacientesRef = collection(db, "pacientes");

    if (editingPatientIndex !== null) {
      const patient = patients[editingPatientIndex];
      const docRef = doc(db, "pacientes", patient.id);
      const { id, historialClinico: _hc, ...payload } = newPatient; // evitar guardar 'id' como campo
      await updateDoc(docRef, payload);
    } else {
      await addDoc(pacientesRef, {
        name: newPatient.name || "",
        phone: newPatient.phone || "",
        email: newPatient.email || "",
        photo: newPatient.photo || "",
      });
    }
  };

  const handleSavePatient = async () => {
    await addOrUpdatePatient();
    closeModal();
  };

  const deletePatient = async (index) => {
    const patient = patients[index];
    if (!patient) return;
    const docRef = doc(db, "pacientes", patient.id);
    await deleteDoc(docRef);
  };

  const handleConfirmDeletePatient = async () => {
    if (itemToDelete !== null) {
      await deletePatient(itemToDelete);
      cancelDelete();
    }
  };

  // ---- Foto (base64 para guardar en Firestore) ----
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewPatient((prev) => ({ ...prev, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // ---- Historia de tratamientos (modal) ----
  const handleViewTreatmentHistory = (patient) => {
    setSelectedPatient(patient);
    setTreatmentHistoryModalOpen(true);
  };

  const handleCloseTreatmentHistory = () => {
    setTreatmentHistoryModalOpen(false);
    setSelectedPatient(null);
  };

  // ---- Historia clínica (modal + guardar en Firestore) ----
  const handleOpenHistory = (patient) => {
    setSelectedPatient(patient);
    setHistorialClinico(
      patient.historialClinico || {
        edad: "",
        antecedentesPersonales: "",
        antecedentesFamiliares: "",
        medicacionHabitual: "",
        alergias: "",
        observaciones: "",
      }
    );
    setHistoryModalOpen(true);
  };

  const handleCloseHistory = () => {
    setHistoryModalOpen(false);
    setSelectedPatient(null);
    setHistorialClinico({
      edad: "",
      antecedentesPersonales: "",
      antecedentesFamiliares: "",
      medicacionHabitual: "",
      alergias: "",
      observaciones: "",
    });
  };

  const handleHistorialChange = (e) => {
    const { id, value } = e.target;
    setHistorialClinico((prev) => ({ ...prev, [id]: value }));
  };

  const updatePatient = async (index, updated) => {
    const patient = patients[index];
    if (!patient) return;
    const docRef = doc(db, "pacientes", patient.id);
    const { id, ...payload } = updated; // no guardar 'id' como campo
    await updateDoc(docRef, payload);
  };

  const handleSaveHistory = async () => {
    if (selectedPatient) {
      const idx = patients.findIndex((p) => p.id === selectedPatient.id);
      if (idx !== -1) {
        await updatePatient(idx, { ...selectedPatient, historialClinico });
      }
      handleCloseHistory();
    }
  };

  // ---- Filtro + mapeo (con índice consistente al array original) ----
  const filteredPatients = patients.filter((p) =>
    p.name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-semibold text-pink-600 mb-4">Gestión de Pacientes</h2>

      <div className="flex justify-between mb-6 items-center">
        <button
          onClick={openAddPatientModal}
          className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition mb-4 flex items-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Agregar Nuevo Paciente</span>
        </button>
        <input
          type="text"
          placeholder="Buscar paciente..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-1/3 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
        />
      </div>

      <div>
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Lista de Pacientes</h3>
        <ul className="space-y-4 max-h-[70vh] overflow-y-auto">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => {
              const originalIndex = patients.findIndex((p) => p.id === patient.id);
              return (
                <li
                  key={patient.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  <div className="flex items-center space-x-4">
                    {patient.photo ? (
                      <img src={patient.photo} alt={patient.name} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl">
                        {patient.name?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-semibold text-gray-800">{patient.name}</p>
                      <p className="text-gray-500 text-sm">{patient.phone}</p>
                      <p className="text-gray-500 text-sm">{patient.email}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewTreatmentHistory(patient)}
                      className="bg-purple-500 text-white px-4 py-2 rounded text-sm hover:bg-purple-600 transition-colors flex items-center space-x-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Historial</span>
                    </button>
                    <button
                      onClick={() => handleOpenHistory(patient)}
                      className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors flex items-center space-x-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <line x1="10" y1="9" x2="8" y2="9"></line>
                      </svg>
                      <span>Historia Clínica</span>
                    </button>
                    <button
                      onClick={() => openEditPatientModal(originalIndex)}
                      className="bg-yellow-400 text-white px-4 py-2 rounded text-sm hover:bg-yellow-500 transition-colors flex items-center space-x-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => confirmDelete(originalIndex)}
                      className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors flex items-center space-x-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Eliminar</span>
                    </button>
                  </div>
                </li>
              );
            })
          ) : (
            <p className="text-center text-gray-500">No se encontraron pacientes.</p>
          )}
        </ul>
      </div>

      {/* Componente oculto para la impresión */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        {selectedPatient && <PrintableHistorial ref={componentRef} patient={selectedPatient} historial={historialClinico} />}
      </div>

      {/* Modal para Agregar/Editar Paciente */}
      <Modal
        title={editingPatientIndex !== null ? "Editar Paciente" : "Agregar Nuevo Paciente"}
        isOpen={isModalOpen}
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Nombre</label>
            <input
              type="text"
              placeholder="Nombre del Paciente"
              value={newPatient.name}
              onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Teléfono</label>
            <input
              type="text"
              placeholder="Teléfono de Contacto"
              value={newPatient.phone}
              onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-1">Email</label>
            <input
              type="email"
              placeholder="Email del Paciente"
              value={newPatient.email}
              onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
            />
          </div>
          <div>
            <label className="block w-full text-sm font-semibold text-gray-700 mb-1">Foto</label>
            <input
              type="file"
              onChange={handlePhotoUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
            />
            {newPatient.photo && (
              <img src={newPatient.photo} alt="Vista previa" className="mt-2 w-24 h-24 object-cover rounded-full" />
            )}
          </div>
        </div>
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

      {/* Modal para la Historia Clínica */}
      <Modal
        title={`Historia Clínica de ${selectedPatient?.name}`}
        isOpen={historyModalOpen}
        onClose={handleCloseHistory}
        size="md"
      >
        {selectedPatient && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label htmlFor="edad" className="text-gray-700 text-sm font-semibold mb-1">Edad:</label>
              <input
                type="text"
                id="edad"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                value={historialClinico.edad}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="antecedentesPersonales" className="text-gray-700 text-sm font-semibold mb-1">Antecedentes Personales:</label>
              <input
                type="text"
                id="antecedentesPersonales"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                value={historialClinico.antecedentesPersonales}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="antecedentesFamiliares" className="text-gray-700 text-sm font-semibold mb-1">Antecedentes Familiares:</label>
              <input
                type="text"
                id="antecedentesFamiliares"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                value={historialClinico.antecedentesFamiliares}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="medicacionHabitual" className="text-gray-700 text-sm font-semibold mb-1">Medicación Habitual:</label>
              <input
                type="text"
                id="medicacionHabitual"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                value={historialClinico.medicacionHabitual}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="alergias" className="text-gray-700 text-sm font-semibold mb-1">Alergias:</label>
              <input
                type="text"
                id="alergias"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all"
                value={historialClinico.alergias}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col col-span-1 md:col-span-2">
              <label htmlFor="observaciones" className="text-gray-700 text-sm font-semibold mb-1">Observaciones:</label>
              <textarea
                id="observaciones"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all min-h-[80px]"
                value={historialClinico.observaciones}
                onChange={handleHistorialChange}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={handleCloseHistory} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 mr-2">
            Cerrar
          </button>
          <button onClick={handleSaveHistory} className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 mr-2">
            Guardar Cambios
          </button>
          <button
            onClick={handlePrint}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2 transition-colors"
          >
            <AiOutlinePrinter className="h-5 w-5" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </Modal>

      {/* Modal para el Historial de Turnos y Tratamientos */}
      <PatientHistoryModal
        isOpen={treatmentHistoryModalOpen}
        onClose={handleCloseTreatmentHistory}
        patient={selectedPatient}
        appointments={appointments}
      />

      {/* Modal de confirmación de eliminación */}
      <Modal
        title="Confirmar Eliminación"
        isOpen={itemToDelete !== null}
        onClose={cancelDelete}
      >
        <p>¿Estás seguro de que deseas eliminar a este paciente? Esta acción no se puede deshacer.</p>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={cancelDelete}
            className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmDeletePatient}
            className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition"
          >
            Confirmar Eliminación
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Pacientes;
