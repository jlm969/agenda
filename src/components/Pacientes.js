import React, { useState } from "react";
import Modal from "./Modal";

const Pacientes = ({
  patients,
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
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [treatmentHistoryModalOpen, setTreatmentHistoryModalOpen] = useState(false);
  const [selectedPatientAppointments, setSelectedPatientAppointments] = useState([]);
  const [isDeleteConfirmationModalOpen, setIsDeleteConfirmationModalOpen] = useState(false);
  const [patientToDeleteIndex, setPatientToDeleteIndex] = useState(null);

  const [historialClinico, setHistorialClinico] = useState({
    edad: "",
    antecedentesPersonales: "",
    antecedentesFamiliares: "",
    medicacionHabitual: "",
    alergias: "",
    observaciones: "",
  });

  const statusTranslations = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    canceled: "Cancelado",
    completed: "Finalizado",
  };

  const handleOpenPatientModal = (index = null) => {
    if (index !== null) {
      editPatient(index);
    } else {
      setNewPatient({ name: "", phone: "", email: "", photo: "" });
      setEditingPatientIndex(null);
    }
    setIsPatientModalOpen(true);
  };

  const handleClosePatientModal = () => {
    setIsPatientModalOpen(false);
    setNewPatient({ name: "", phone: "", email: "", photo: "" });
    setEditingPatientIndex(null);
  };

  const handleSavePatient = () => {
    addOrUpdatePatient();
    handleClosePatientModal();
  };

  const handleDeletePatientClick = (index) => {
    setPatientToDeleteIndex(index);
    setIsDeleteConfirmationModalOpen(true);
  };

  const handleConfirmDeletePatient = () => {
    deletePatient(patientToDeleteIndex);
    setIsDeleteConfirmationModalOpen(false);
    setPatientToDeleteIndex(null);
  };

  const handleCancelDelete = () => {
    setIsDeleteConfirmationModalOpen(false);
    setPatientToDeleteIndex(null);
  };

  const handleOpenHistory = (patientIndex) => {
    const patient = patients[patientIndex];
    setSelectedPatient(patient);
    setHistorialClinico(patient.historialClinico || {
      edad: "",
      antecedentesPersonales: "",
      antecedentesFamiliares: "",
      medicacionHabitual: "",
      alergias: "",
      observaciones: "",
    });
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
    setHistorialClinico(prevHistorial => ({
      ...prevHistorial,
      [id]: value,
    }));
  };

  const handleSaveHistory = () => {
    if (selectedPatient) {
      const patientIndex = patients.findIndex(p => p.email === selectedPatient.email);
      updatePatient(patientIndex, { historialClinico: historialClinico });
      handleCloseHistory();
    }
  };

  const handleViewTreatmentHistory = (patientIndex) => {
    const patient = patients[patientIndex];
    const patientAppointments = appointments.filter(
      (app) => app.patientName === patient.name
    );
    setSelectedPatient(patient);
    setSelectedPatientAppointments(patientAppointments);
    setTreatmentHistoryModalOpen(true);
  };

  const filteredPatients = patients.filter((patient) =>
    patient.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-semibold text-pink-600 mb-4">Gestión de Pacientes</h2>
      <div className="flex justify-between mb-6 items-center">
        <button
          onClick={() => handleOpenPatientModal()}
          className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition mb-4 flex items-center space-x-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
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
        <ul className="space-y-4">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex items-center space-x-4">
                  {patient.photo ? (
                    <img src={patient.photo} alt={patient.name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl">
                      {patient.name.charAt(0)}
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
                    onClick={() => handleViewTreatmentHistory(index)}
                    className="bg-purple-500 text-white px-4 py-2 rounded text-sm hover:bg-purple-600 transition-colors flex items-center space-x-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Historial</span>
                  </button>
                  <button
                    onClick={() => handleOpenHistory(index)}
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
                    onClick={() => handleOpenPatientModal(index)}
                    className="bg-yellow-400 text-white px-4 py-2 rounded text-sm hover:bg-yellow-500 transition-colors flex items-center space-x-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDeletePatientClick(index)}
                    className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors flex items-center space-x-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
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
            ))
          ) : (
            <p className="text-center text-gray-500">No se encontraron pacientes.</p>
          )}
        </ul>
      </div>

      {/* Modal para Agregar/Editar Paciente */}
      <Modal
        title={editingPatientIndex !== null ? "Editar Paciente" : "Agregar Nuevo Paciente"}
        isOpen={isPatientModalOpen}
        onClose={handleClosePatientModal}
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
            <label className="block text-gray-700 text-sm font-semibold mb-1">Foto</label>
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
            onClick={handleClosePatientModal}
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

      {/* Modal para el Historial Clínico (ACTUALIZADO) */}
      <Modal
        title={`Historia Clínica de ${selectedPatient?.name}`}
        isOpen={historyModalOpen}
        onClose={handleCloseHistory}
      >
        {selectedPatient && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="edad" className="font-semibold text-gray-700">Edad:</label>
              <input
                type="text"
                id="edad"
                className="border p-2 rounded flex-grow"
                value={historialClinico.edad}
                onChange={handleHistorialChange}
              />
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="antecedentesPersonales" className="font-semibold text-gray-700 whitespace-nowrap">Antecedentes Personales:</label>
              <input
                type="text"
                id="antecedentesPersonales"
                className="border p-2 rounded flex-grow"
                value={historialClinico.antecedentesPersonales}
                onChange={handleHistorialChange}
              />
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="antecedentesFamiliares" className="font-semibold text-gray-700 whitespace-nowrap">Antecedentes Familiares:</label>
              <input
                type="text"
                id="antecedentesFamiliares"
                className="border p-2 rounded flex-grow"
                value={historialClinico.antecedentesFamiliares}
                onChange={handleHistorialChange}
              />
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="medicacionHabitual" className="font-semibold text-gray-700 whitespace-nowrap">Medicación Habitual:</label>
              <input
                type="text"
                id="medicacionHabitual"
                className="border p-2 rounded flex-grow"
                value={historialClinico.medicacionHabitual}
                onChange={handleHistorialChange}
              />
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="alergias" className="font-semibold text-gray-700 whitespace-nowrap">Alergias:</label>
              <input
                type="text"
                id="alergias"
                className="border p-2 rounded flex-grow"
                value={historialClinico.alergias}
                onChange={handleHistorialChange}
              />
            </div>

            <div className="flex items-start space-x-2">
              <label htmlFor="observaciones" className="font-semibold text-gray-700 whitespace-nowrap pt-2">Observaciones:</label>
              <textarea
                id="observaciones"
                className="border p-2 rounded flex-grow min-h-[40px]" // `min-h-[40px]` asegura que ocupe un renglón por defecto
                value={historialClinico.observaciones}
                onChange={handleHistorialChange}
              />
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={handleCloseHistory} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 mr-2">
                Cerrar
              </button>
              <button onClick={handleSaveHistory} className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600">
                Guardar Cambios
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal para el Historial de Turnos y Tratamientos */}
      <Modal
        title={`Historial de Turnos de ${selectedPatient?.name}`}
        isOpen={treatmentHistoryModalOpen}
        onClose={() => setTreatmentHistoryModalOpen(false)}
      >
        {selectedPatientAppointments.length > 0 ? (
          <div className="space-y-4">
            {selectedPatientAppointments.map((app, index) => (
              <div key={index} className="p-4 border rounded-lg shadow-sm bg-gray-50">
                <p><strong>Fecha:</strong> {app.date}</p>
                <p><strong>Hora:</strong> {app.time}</p>
                <p><strong>Consultorio:</strong> {app.consultorio}</p>
                <p><strong>Tratamiento:</strong> {app.treatment}</p>
                <p>
                  <strong>Estado:</strong> {statusTranslations[app.status] || app.status}
                </p>
                {app.notes && <p><strong>Notas:</strong> {app.notes}</p>}
                {app.cancelReason && <p className="text-red-600"><strong>Motivo de Cancelación:</strong> {app.cancelReason}</p>}
                {app.photos && app.photos.length > 0 && (
                  <div className="mt-2">
                    <strong>Fotos:</strong>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {app.photos.map((photo, photoIndex) => (
                        <img key={photoIndex} src={photo} alt={`Tratamiento ${index}`} className="w-16 h-16 object-cover rounded" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">No hay turnos registrados para este paciente.</p>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={() => setTreatmentHistoryModalOpen(false)}
            className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        title="Confirmar Eliminación"
        isOpen={isDeleteConfirmationModalOpen}
        onClose={handleCancelDelete}
      >
        <p>¿Estás seguro de que deseas eliminar a este paciente? Esta acción no se puede deshacer.</p>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={handleCancelDelete}
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