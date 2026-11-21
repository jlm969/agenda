import React, { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import useCRUDModal from "../hooks/useCRUDModal";
import PatientHistoryModal from "./PatientHistoryModal";
import { useReactToPrint } from "react-to-print";
import { AiOutlinePrinter } from "react-icons/ai";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

const EMPTY_PATIENT = { name: "", phone: "", email: "", photo: "" };
const EMPTY_HISTORIAL = {
  edad: "",
  antecedentesPersonales: "",
  antecedentesFamiliares: "",
  medicacionHabitual: "",
  alergias: "",
  observaciones: "",
};

// Minúsculas y sin acentos, para buscar ("gomez" encuentra "Gómez")
const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Las fotos se guardan dentro del documento del paciente (Firestore admite hasta 1 MB por documento).
// Una foto de celular pesa varios MB, así que se achica antes de guardarla.
const MAX_PHOTO_SIZE = 320;
const resizePhoto = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });

// Botones de cada paciente: compactos en el celular, con ícono en pantallas grandes
const ACTION_BTN =
  "px-1 sm:px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-colors flex items-center justify-center sm:space-x-1";
const NEUTRAL_BTN = "bg-white text-gray-700 border-gray-300 hover:bg-gray-50";
const DANGER_BTN = "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
const ICON = "hidden sm:block h-4 w-4";

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

// Los pacientes llegan desde App.js (ya cargados en tiempo real)
const Pacientes = ({ patients = [] }) => {
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT);
  const [editingPatientIndex, setEditingPatientIndex] = useState(null);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const { isModalOpen, itemToDelete, openModal, closeModal, confirmDelete, cancelDelete } = useCRUDModal();

  const [treatmentHistoryModalOpen, setTreatmentHistoryModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Turnos del paciente elegido (para el modal de Historial)
  const [turnosDelPaciente, setTurnosDelPaciente] = useState([]);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historialClinico, setHistorialClinico] = useState(EMPTY_HISTORIAL);
  const [historialDirty, setHistorialDirty] = useState(false);

  const componentRef = useRef();

  // ---- Impresión ----
  const handlePrint = useReactToPrint({
    contentRef: componentRef, // react-to-print 3.x
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

  // Turnos del paciente seleccionado (en tiempo real)
  useEffect(() => {
    if (!selectedPatient) return undefined;

    const turnosRef = collection(db, "turnos");
    const q = query(turnosRef, where("patientName", "==", selectedPatient.name));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const turnosList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTurnosDelPaciente(turnosList);
    });

    return () => unsubscribe();
  }, [selectedPatient]);

  // ---- Alta, edición y baja ----
  const openAddPatientModal = () => {
    setNewPatient(EMPTY_PATIENT);
    setEditingPatientIndex(null);
    openModal();
  };

  const openEditPatientModal = (index) => {
    setEditingPatientIndex(index);
    // Los pacientes viejos pueden no tener todos los campos: se completan vacíos
    setNewPatient({ ...EMPTY_PATIENT, ...patients[index] });
    openModal();
  };

  const addOrUpdatePatient = async () => {
    if (editingPatientIndex !== null) {
      const patient = patients[editingPatientIndex];
      const docRef = doc(db, "pacientes", patient.id);
      const { id, historialClinico: _hc, ...payload } = newPatient; // 'id' no se guarda como campo
      await updateDoc(docRef, payload);
    } else {
      await addDoc(collection(db, "pacientes"), {
        name: newPatient.name || "",
        phone: newPatient.phone || "",
        email: newPatient.email || "",
        photo: newPatient.photo || "",
      });
    }
  };

  const handleSavePatient = async () => {
    if (!String(newPatient.name || "").trim()) {
      alert("El nombre del paciente es obligatorio.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await addOrUpdatePatient();
      closeModal();
    } catch (error) {
      console.error("Error al guardar el paciente:", error);
      alert("No se pudo guardar el paciente. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeletePatient = async () => {
    if (itemToDelete === null) return;
    const patient = patients[itemToDelete];
    if (!patient) {
      cancelDelete();
      return;
    }
    try {
      await deleteDoc(doc(db, "pacientes", patient.id));
      cancelDelete();
    } catch (error) {
      console.error("Error al eliminar el paciente:", error);
      alert("No se pudo eliminar. Revisá tu conexión e intentá de nuevo.");
    }
  };

  // ---- Foto ----
  const handlePhotoUpload = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const photo = await resizePhoto(file);
      setNewPatient((prev) => ({ ...prev, photo }));
    } catch (error) {
      console.error("Error con la foto:", error);
      alert("No se pudo cargar la foto. Probá con otra imagen.");
    }
    input.value = "";
  };

  // ---- Historial de turnos (modal) ----
  const handleViewTreatmentHistory = (patient) => {
    setSelectedPatient(patient);
    setTreatmentHistoryModalOpen(true);
  };

  const handleCloseTreatmentHistory = () => {
    setTreatmentHistoryModalOpen(false);
    setSelectedPatient(null);
    setTurnosDelPaciente([]);
  };

  // ---- Historia clínica (modal + guardar en Firestore) ----
  const handleOpenHistory = (patient) => {
    setHistorialDirty(false);
    setSelectedPatient(patient);
    setHistorialClinico(patient.historialClinico || EMPTY_HISTORIAL);
    setHistoryModalOpen(true);
  };

  const handleCloseHistory = () => {
    setHistoryModalOpen(false);
    setSelectedPatient(null);
    setHistorialClinico(EMPTY_HISTORIAL);
  };

  const handleHistorialChange = (e) => {
    const { id, value } = e.target;
    setHistorialClinico((prev) => ({ ...prev, [id]: value }));
    setHistorialDirty(true);
  };

  const handleSaveHistory = async () => {
    if (!selectedPatient) return;
    const patient = patients.find((p) => p.id === selectedPatient.id);
    if (!patient) return;
    if (saving) return;
    setSaving(true);
    try {
      const { id, ...payload } = { ...patient, historialClinico };
      await updateDoc(doc(db, "pacientes", patient.id), payload);
      handleCloseHistory();
    } catch (error) {
      console.error("Error al guardar la historia clínica:", error);
      alert("No se pudo guardar la historia clínica. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Búsqueda (sin importar mayúsculas ni acentos) ----
  const q = normalize(filter);
  const filteredPatients = q ? patients.filter((p) => normalize(p.name).includes(q)) : patients;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-pink-600 mb-4">Gestión de Pacientes</h2>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <button
          onClick={openAddPatientModal}
          className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition flex items-center space-x-2"
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
          aria-label="Buscar paciente"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[180px] p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400"
        />
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {q ? `${filteredPatients.length} de ${patients.length} pacientes` : `${patients.length} pacientes`}
      </p>

      <ul className="space-y-3 max-h-[70vh] overflow-y-auto">
        {filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => {
            const originalIndex = patients.findIndex((p) => p.id === patient.id);
            return (
              <li
                key={patient.id}
                className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {patient.photo ? (
                    <img src={patient.photo} alt={patient.name} className="w-10 h-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                      {patient.name?.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-lg text-pink-800 truncate">{patient.name}</div>
                    {(patient.phone || patient.email) && (
                      <div className="text-sm text-gray-700 truncate">
                        {[patient.phone, patient.email].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2 shrink-0">
                  <button
                    onClick={() => handleViewTreatmentHistory(patient)}
                    className={`${ACTION_BTN} ${NEUTRAL_BTN}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={ICON} viewBox="0 0 20 20" fill="currentColor">
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
                    className={`${ACTION_BTN} ${NEUTRAL_BTN}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={ICON}
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
                    <span className="sm:hidden">Clínica</span>
                    <span className="hidden sm:inline">Historia Clínica</span>
                  </button>
                  <button
                    onClick={() => openEditPatientModal(originalIndex)}
                    className={`${ACTION_BTN} ${NEUTRAL_BTN}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={ICON} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => confirmDelete(originalIndex)}
                    className={`${ACTION_BTN} ${DANGER_BTN}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={ICON} viewBox="0 0 20 20" fill="currentColor">
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

      {/* Componente oculto para la impresión */}
      <div style={{ position: "absolute", top: "-9999px", left: "-9999px" }}>
        {selectedPatient && <PrintableHistorial ref={componentRef} patient={selectedPatient} historial={historialClinico} />}
      </div>

      {/* Modal para Agregar/Editar Paciente */}
      <Modal
        title={editingPatientIndex !== null ? "Editar Paciente" : "Agregar Paciente"}
        isOpen={isModalOpen}
        onClose={closeModal}
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nombre del paciente"
            aria-label="Nombre"
            className="border p-3 rounded w-full"
            value={newPatient.name}
            onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
          />
          <input
            type="tel"
            inputMode="tel"
            placeholder="Teléfono (código de área y número)"
            aria-label="Teléfono"
            className="border p-3 rounded w-full"
            value={newPatient.phone}
            onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            className="border p-3 rounded w-full"
            value={newPatient.email}
            onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
          />
          <div className="flex items-center gap-3">
            {newPatient.photo ? (
              <img src={newPatient.photo} alt="Vista previa" className="w-14 h-14 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                Foto
              </div>
            )}
            <div className="min-w-0 flex-1">
              <input
                type="file"
                accept="image/*"
                aria-label="Foto"
                onChange={handlePhotoUpload}
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
              />
              {newPatient.photo && (
                <button
                  type="button"
                  onClick={() => setNewPatient({ ...newPatient, photo: "" })}
                  className="mt-1 text-xs text-red-600 underline"
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={closeModal}
            className="bg-gray-300 text-gray-700 px-4 sm:px-6 py-2 rounded hover:bg-gray-400 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSavePatient}
            className="bg-pink-500 text-white px-4 sm:px-6 py-2 rounded hover:bg-pink-600 transition whitespace-nowrap"
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
      >
        {selectedPatient && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label htmlFor="edad" className="text-gray-700 text-sm font-semibold mb-1">Edad:</label>
              <input
                type="text"
                id="edad"
                className="border p-2.5 rounded w-full"
                value={historialClinico.edad}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="antecedentesPersonales" className="text-gray-700 text-sm font-semibold mb-1">Antecedentes Personales:</label>
              <input
                type="text"
                id="antecedentesPersonales"
                className="border p-2.5 rounded w-full"
                value={historialClinico.antecedentesPersonales}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="antecedentesFamiliares" className="text-gray-700 text-sm font-semibold mb-1">Antecedentes Familiares:</label>
              <input
                type="text"
                id="antecedentesFamiliares"
                className="border p-2.5 rounded w-full"
                value={historialClinico.antecedentesFamiliares}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="medicacionHabitual" className="text-gray-700 text-sm font-semibold mb-1">Medicación Habitual:</label>
              <input
                type="text"
                id="medicacionHabitual"
                className="border p-2.5 rounded w-full"
                value={historialClinico.medicacionHabitual}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="alergias" className="text-gray-700 text-sm font-semibold mb-1">Alergias:</label>
              <input
                type="text"
                id="alergias"
                className="border p-2.5 rounded w-full"
                value={historialClinico.alergias}
                onChange={handleHistorialChange}
              />
            </div>
            <div className="flex flex-col sm:col-span-2">
              <label htmlFor="observaciones" className="text-gray-700 text-sm font-semibold mb-1">Observaciones:</label>
              <textarea
                id="observaciones"
                className="border p-2.5 rounded w-full min-h-[80px]"
                value={historialClinico.observaciones}
                onChange={handleHistorialChange}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <button onClick={handleCloseHistory} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
            Cerrar
          </button>
          <button onClick={handleSaveHistory} className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600">
            Guardar Cambios
          </button>
          <button
            onClick={handlePrint}
            className={`bg-green-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${historialDirty ? "opacity-50 cursor-not-allowed" : "hover:bg-green-600"}`}
            disabled={historialDirty}
            title={historialDirty ? "Guarda los cambios antes de imprimir" : "Imprimir / PDF"}
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
        appointments={turnosDelPaciente}
      />

      {/* Modal de confirmación de eliminación */}
      <Modal title="Confirmar Eliminación" isOpen={itemToDelete !== null} onClose={cancelDelete}>
        <p>¿Estás seguro de que deseas eliminar a este paciente? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={cancelDelete}
            className="bg-gray-300 text-gray-700 px-4 sm:px-6 py-2 rounded hover:bg-gray-400 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmDeletePatient}
            className="bg-red-500 text-white px-4 sm:px-6 py-2 rounded hover:bg-red-600 transition"
          >
            Confirmar Eliminación
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Pacientes;
