import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { db } from './firebase';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where 
} from "firebase/firestore";

// Helper para generar los turnos de 30 minutos
const generateTimeSlots = () => {
  const slots = [];
  const startHour = 9;
  const endHour = 20;
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

// Helper para obtener el inicio de la semana
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Semana empieza lunes
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const Agenda = ({ patients, consultorios, treatments }) => {
  // Estado local
  const [appointments, setAppointments] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({ date: "", time: "", patientName: "", consultorio: "", treatment: "", status: "confirmed", notes: "", photos: [] });
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [dailyAppointments, setDailyAppointments] = useState([]);
  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

  const timeSlots = generateTimeSlots();
  const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Carga turnos desde Firebase Firestore
  const loadAppointments = async () => {
    const appointmentsCol = collection(db, "appointments");
    const appointmentsSnapshot = await getDocs(appointmentsCol);
    const appointmentsList = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAppointments(appointmentsList);
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  // Función para encontrar índice por id
  const findAppointmentIndexById = (id) => appointments.findIndex(a => a.id === id);

  // Verifica si hay turno para día, hora y consultorio
  const isAppointmentBooked = (day, time) => {
    const formattedDate = day.toISOString().split('T')[0];
    return appointments.find(a => a.date === formattedDate && a.time === time);
  };

  // Manejadores CRUD Firebase

  // Agregar turno nuevo
  const addAppointment = async (appointment) => {
    try {
      const appointmentsCol = collection(db, "appointments");
      // Verificar que no exista turno en misma fecha, hora y consultorio
      const q = query(appointmentsCol,
        where("date", "==", appointment.date),
        where("time", "==", appointment.time),
        where("consultorio", "==", appointment.consultorio)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert("Ya existe un turno para ese día, hora y consultorio.");
        return false;
      }
      await addDoc(appointmentsCol, appointment);
      await loadAppointments();
      return true;
    } catch (error) {
      console.error("Error agregando turno:", error);
      return false;
    }
  };

  // Actualizar turno
  const updateAppointment = async (appointmentId, updatedAppointment) => {
    try {
      const appointmentDoc = doc(db, "appointments", appointmentId);
      await updateDoc(appointmentDoc, updatedAppointment);
      await loadAppointments();
    } catch (error) {
      console.error("Error actualizando turno:", error);
    }
  };

  // Eliminar turno
  const deleteAppointment = async (appointmentId) => {
    try {
      const appointmentDoc = doc(db, "appointments", appointmentId);
      await deleteDoc(appointmentDoc);
      await loadAppointments();
    } catch (error) {
      console.error("Error eliminando turno:", error);
    }
  };

  // Manejo clicks para abrir modal en slot
  const handleSlotClick = (day, time) => {
    const formattedDate = day.toISOString().split('T')[0];
    const existingAppointment = isAppointmentBooked(day, time);

    if (existingAppointment) {
      setSelectedAppointmentDetails(existingAppointment);
      setEditingAppointmentId(existingAppointment.id);
      setNewAppointment({ ...existingAppointment });
    } else {
      setNewAppointment({
        date: formattedDate,
        time: time,
        patientName: "",
        consultorio: "",
        treatment: "",
        status: "confirmed",
        notes: "",
        photos: []
      });
      setSelectedAppointmentDetails(null);
      setEditingAppointmentId(null);
    }
    setAppointmentModalOpen(true);
    setIsFinishing(false);
    setIsCancelling(false);
    setIsReassigning(false);
    setCancelReason(existingAppointment?.cancelReason || "");
  };

  const handleDayHeaderClick = (date) => {
    const formattedDate = date.toISOString().split('T')[0];
    const turns = appointments.filter(a => a.date === formattedDate);
    setDailyAppointments(turns);
    setDailyModalOpen(true);
  };

  const closeModal = () => {
    setAppointmentModalOpen(false);
    setDailyModalOpen(false);
    setNewAppointment({ date: "", time: "", patientName: "", consultorio: "", treatment: "", status: "confirmed", notes: "", photos: [] });
    setSelectedAppointmentDetails(null);
    setEditingAppointmentId(null);
    setIsFinishing(false);
    setIsCancelling(false);
    setIsReassigning(false);
    setCancelReason("");
    setIsDeleteModalOpen(false);
    setAppointmentToDelete(null);
  };

  const handleAddAppointment = async () => {
    if (newAppointment.patientName && newAppointment.consultorio && newAppointment.treatment) {
      const appointmentToAdd = { ...newAppointment, status: "confirmed" };
      const success = await addAppointment(appointmentToAdd);
      if (success) {
        closeModal();
      }
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  const handleUpdateAppointment = async () => {
    if (newAppointment.patientName && newAppointment.consultorio && newAppointment.treatment) {
      await updateAppointment(editingAppointmentId, newAppointment);
      closeModal();
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  const handleCancelAppointment = async () => {
    if (cancelReason.trim()) {
      const cancelledAppointment = {
        ...newAppointment,
        status: 'cancelled',
        cancelReason: cancelReason,
        notes: newAppointment.notes || '',
        photos: newAppointment.photos || [],
      };
      await updateAppointment(editingAppointmentId, cancelledAppointment);
      closeModal();
    } else {
      alert("Por favor, ingresa el motivo de la cancelación.");
    }
  };

  const handleFinishTreatment = () => {
    setIsFinishing(true);
  };

  const handleSaveFinishedTreatment = async () => {
    const finishedAppointment = {
      ...newAppointment,
      status: 'completed'
    };
    await updateAppointment(editingAppointmentId, finishedAppointment);
    closeModal();
  };

  const nextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const getWeekDays = () => {
    const days = [];
    let day = new Date(currentWeekStart);
    for (let i = 0; i < 6; i++) { // Lunes a Sábado
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }
    return days;
  };

  const handleEditClick = () => {
    if (selectedAppointmentDetails.status === 'cancelled') {
      setIsReassigning(true);
      setNewAppointment({
        date: selectedAppointmentDetails.date,
        time: selectedAppointmentDetails.time,
        consultorio: selectedAppointmentDetails.consultorio,
        patientName: "",
        treatment: "",
        status: "confirmed",
        notes: "",
        photos: []
      });
      setSelectedAppointmentDetails(null);
    } else {
      setSelectedAppointmentDetails(null);
    }
  };

  const handleReassignAppointment = async () => {
    if (newAppointment.patientName && newAppointment.consultorio && newAppointment.treatment) {
      const reAssignedAppointment = {
        ...newAppointment,
        status: 'confirmed',
        cancelReason: '',
        notes: '',
        photos: []
      };
      await updateAppointment(editingAppointmentId, reAssignedAppointment);
      closeModal();
    } else {
      alert("Por favor, completa todos los campos.");
    }
  };

  // Confirmación de eliminación de turno
  const confirmDeleteAppointment = (appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteAppointment = async () => {
    if (appointmentToDelete) {
      await deleteAppointment(appointmentToDelete.id);
      setIsDeleteModalOpen(false);
      setAppointmentToDelete(null);
      setDailyAppointments(dailyAppointments.filter(app => app.id !== appointmentToDelete.id));
    }
  };

  const handleCancelDeleteAppointment = () => {
    setIsDeleteModalOpen(false);
    setAppointmentToDelete(null);
  };

  const isEditing = editingAppointmentId !== null && selectedAppointmentDetails === null && !isFinishing && !isCancelling && !isReassigning;
  const isViewing = selectedAppointmentDetails !== null && !isFinishing && !isCancelling && !isReassigning;
  const isAdding = !isEditing && !isViewing && !isFinishing && !isCancelling && !isReassigning;

  const isCompleted = selectedAppointmentDetails?.status === 'completed';
  const isCancelled = selectedAppointmentDetails?.status === 'cancelled';

  return (
    <div>
      <h2 className="text-2xl font-semibold text-pink-600 mb-4">Agenda de Turnos</h2>

      <div className="flex justify-between items-center mb-6">
        <button onClick={prevWeek} className="bg-gray-200 p-2 rounded-full hover:bg-gray-300 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-xl font-bold text-pink-800">
          Semana del {currentWeekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
        </h3>
        <button onClick={nextWeek} className="bg-gray-200 p-2 rounded-full hover:bg-gray-300 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-pink-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
              {getWeekDays().map((day, index) => (
                <th
                  key={index}
                  onClick={() => handleDayHeaderClick(day)}
                  className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-pink-100 transition-colors"
                >
                  {weekDays[index]} <br />
                  <span className="text-sm font-semibold">{day.getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timeSlots.map((time, timeIndex) => (
              <tr key={timeIndex}>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{time}</td>
                {getWeekDays().map((day, dayIndex) => {
                  const appointment = isAppointmentBooked(day, time);
                  let cellClass = "bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200";
                  if (appointment) {
                    if (appointment.status === 'completed') {
                      cellClass = "bg-green-200 text-green-900 cursor-pointer hover:bg-green-300";
                    } else if (appointment.status === 'cancelled') {
                      cellClass = "bg-red-400 text-red-950 font-semibold cursor-pointer hover:bg-red-500";
                    } else {
                      cellClass = "bg-pink-200 text-pink-900 cursor-pointer hover:bg-pink-300";
                    }
                  }

                  return (
                    <td key={dayIndex} className={`px-2 py-2 text-xs text-center border ${cellClass}`}
                      onClick={() => handleSlotClick(day, time)}>
                      {appointment ? (
                        <div>
                          <p className="font-bold">{appointment.patientName}</p>
                          <p>{appointment.treatment}</p>
                          <p>{appointment.consultorio}</p>
                        </div>
                      ) : (
                        <span className="text-gray-500">Disponible</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal principal para agendar, ver, editar, cancelar o finalizar turno */}
      <Modal
        title={isAdding ? "Agendar Nuevo Turno" : (isFinishing ? "Finalizar Tratamiento" : (isCancelling ? "Cancelar Turno" : (isReassigning ? "Reasignar Turno Cancelado" : "Detalles del Turno")))}
        isOpen={appointmentModalOpen}
        onClose={closeModal}
      >
        {isViewing ? (
          <div className="flex flex-col gap-4">
            <p className="text-gray-700"><strong>Paciente:</strong> {selectedAppointmentDetails.patientName}</p>
            <p className="text-gray-700"><strong>Fecha:</strong> {selectedAppointmentDetails.date}</p>
            <p className="text-gray-700"><strong>Hora:</strong> {selectedAppointmentDetails.time}</p>
            <p className="text-gray-700"><strong>Consultorio:</strong> {selectedAppointmentDetails.consultorio}</p>
            <p className="text-gray-700"><strong>Tratamiento:</strong> {selectedAppointmentDetails.treatment}</p>
            {selectedAppointmentDetails.status === 'cancelled' && (
              <p className="text-gray-700"><strong>Motivo de Cancelación:</strong> {selectedAppointmentDetails.cancelReason}</p>
            )}
            {(selectedAppointmentDetails.status === 'completed' || selectedAppointmentDetails.notes || (selectedAppointmentDetails.photos && selectedAppointmentDetails.photos.length > 0)) && (
              <>
                <p className="text-gray-700"><strong>Notas:</strong> {selectedAppointmentDetails.notes}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAppointmentDetails.photos && selectedAppointmentDetails.photos.map((photo, index) => (
                    <img key={index} src={photo} alt={`tratamiento ${index}`} className="w-20 h-20 object-cover rounded" />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-gray-700"><strong>Fecha:</strong> {newAppointment.date}</p>
            <p className="text-gray-700"><strong>Hora:</strong> {newAppointment.time}</p>
            <select
              className="border p-3 rounded w-full"
              value={newAppointment.consultorio}
              onChange={(e) => setNewAppointment({ ...newAppointment, consultorio: e.target.value })}
              disabled={isFinishing || isCancelling || isReassigning}
            >
              <option value="">Seleccionar consultorio</option>
              {consultorios.map((c, i) => (
                <option key={i} value={c.name}>{c.name}</option>
              ))}
            </select>
            <select
              className="border p-3 rounded w-full"
              value={newAppointment.patientName}
              onChange={(e) => setNewAppointment({ ...newAppointment, patientName: e.target.value })}
              disabled={isFinishing || isCancelling}
            >
              <option value="">Seleccionar paciente</option>
              {patients.map((p, i) => (
                <option key={i} value={p.name}>{p.name}</option>
              ))}
            </select>
            <select
              className="border p-3 rounded w-full"
              value={newAppointment.treatment}
              onChange={(e) => setNewAppointment({ ...newAppointment, treatment: e.target.value })}
              disabled={isFinishing || isCancelling}
            >
              <option value="">Seleccionar tratamiento</option>
              {treatments.map((t, i) => (
                <option key={i} value={t.name}>{t.name}</option>
              ))}
            </select>
            {isFinishing && (
              <>
                <textarea
                  placeholder="Notas del tratamiento"
                  className="border p-3 rounded w-full mt-2"
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                />
                <label className="block text-sm font-medium text-gray-700">Subir fotos</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setNewAppointment(prev => ({
                        ...prev,
                        photos: prev.photos ? [...prev.photos, reader.result] : [reader.result]
                      }));
                    };
                    if (file) {
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="p-2 rounded w-full"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {newAppointment.photos && newAppointment.photos.map((photo, index) => (
                    <img key={index} src={photo} alt={`tratamiento ${index}`} className="w-20 h-20 object-cover rounded" />
                  ))}
                </div>
              </>
            )}
            {isCancelling && (
              <>
                <textarea
                  placeholder="Motivo de cancelación"
                  className="border p-3 rounded w-full mt-2"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </>
            )}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 transition mr-2"
            onClick={closeModal}
          >
            {isAdding || isEditing || isCancelling || isFinishing || isReassigning ? "Cancelar" : "Cerrar"}
          </button>
          {isViewing && (
            <>
              {!isCompleted && !isCancelled && (
                <button
                  className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition mr-2"
                  onClick={() => setIsCancelling(true)}
                >
                  Cancelar Turno
                </button>
              )}
              {!isCompleted && (
                <button
                  className="bg-yellow-400 text-white px-6 py-2 rounded hover:bg-yellow-500 transition mr-2"
                  onClick={handleEditClick}
                >
                  Editar
                </button>
              )}
              {!isCancelled && (
                <button
                  className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 transition"
                  onClick={handleFinishTreatment}
                >
                  {isCompleted ? 'Editar/Actualizar Tratamiento' : 'Finalizar Tratamiento'}
                </button>
              )}
            </>
          )}
          {isEditing && (
            <button
              className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
              onClick={handleUpdateAppointment}
            >
              Guardar Cambios
            </button>
          )}
          {isReassigning && (
            <button
              className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
              onClick={handleReassignAppointment}
            >
              Agendar Nuevo Turno
            </button>
          )}
          {isAdding && (
            <button
              className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
              onClick={handleAddAppointment}
            >
              Agendar
            </button>
          )}
          {isFinishing && (
            <button
              className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
              onClick={handleSaveFinishedTreatment}
            >
              Guardar y Finalizar
            </button>
          )}
          {isCancelling && (
            <button
              className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition"
              onClick={handleCancelAppointment}
            >
              Confirmar Cancelación
            </button>
          )}
        </div>
      </Modal>

      {/* Modal para ver turnos del día */}
      <Modal title={`Turnos del día`} isOpen={dailyModalOpen} onClose={closeModal}>
        {dailyAppointments.length > 0 ? (
          <ul className="max-h-[60vh] overflow-y-auto">
            {dailyAppointments.map((a) => (
              <li key={a.id} className="bg-gray-100 p-3 mb-2 rounded flex justify-between items-center">
                <div>
                  <div className="font-bold">{a.patientName}</div>
                  <div className="text-sm">
                    Hora: {a.time} | Consultorio: {a.consultorio} | Tratamiento: {a.treatment}
                  </div>
                  <div className="text-sm mt-1">
                    <span className="font-semibold">Estado:</span> {a.status === 'confirmed' ? 'Confirmado' : a.status === 'cancelled' ? 'Cancelado' : a.status === 'completed' ? 'Finalizado' : 'Sin estado'}
                  </div>
                </div>
                {a.status !== 'completed' && (
                  <button
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                    onClick={() => confirmDeleteAppointment(a)}
                  >
                    Eliminar
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay turnos agendados para este día.</p>
        )}
        <div className="flex justify-end mt-4">
          <button
            className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
            onClick={closeModal}
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Modal de confirmación de eliminación para turnos */}
      <Modal title="Confirmar Eliminación de Turno" isOpen={isDeleteModalOpen} onClose={handleCancelDeleteAppointment}>
        <p>¿Estás seguro de que quieres eliminar este turno? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end mt-4">
          <button
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400 transition mr-2"
            onClick={handleCancelDeleteAppointment}
          >
            Cancelar
          </button>
          <button
            className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition"
            onClick={handleConfirmDeleteAppointment}
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Agenda;
