import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Modal from "./Modal";
import SearchableDropdown from "./SearchableDropdown";

// Helper para generar los turnos de 30 minutos
const generateTimeSlots = () => {
  const slots = [];
  const startHour = 9;
  const endHour = 20;
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

// Helper para obtener el inicio de la semana (lunes)
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const Agenda = ({ patients, consultorios, treatments }) => {
  // === ESTADOS ===
  const [turnos, setTurnos] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({});
  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState(null);
  const [editingAppointmentDocId, setEditingAppointmentDocId] = useState(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [dailyAppointments, setDailyAppointments] = useState([]);
  const [selectedDayForModal, setSelectedDayForModal] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

  const timeSlots = generateTimeSlots();
  const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const turnosRef = collection(db, "turnos");

  // === EFECTO PARA CARGAR TURNOS DE FIREBASE ===
  useEffect(() => {
    const unsubscribe = onSnapshot(turnosRef, (snapshot) => {
      const turnosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTurnos(turnosList);
    });
    return () => unsubscribe();
  }, [turnosRef]);

  // === HELPERS ===
  const getWeekDays = () => {
    const days = [];
    let day = new Date(currentWeekStart);
    for (let i = 0; i < 6; i++) {
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }
    return days;
  };

  const isAppointmentBooked = (day, time) => {
    const formattedDate = day.toISOString().split('T')[0];
    return turnos.find(a => a.date === formattedDate && a.time === time);
  };

  const handleSlotClick = (day, time) => {
    const formattedDate = day.toISOString().split("T")[0];
    const existingAppointment = isAppointmentBooked(day, time);

    closeModal();

    if (existingAppointment) {
      setSelectedAppointmentDetails(existingAppointment);
      setNewAppointment({ ...existingAppointment });
      setEditingAppointmentDocId(existingAppointment.id);
      setCancelReason(existingAppointment.cancelReason || "");
    } else {
      setNewAppointment({
        date: formattedDate,
        time: time,
        patientName: "",
        consultorio: "",
        treatment: "",
        status: "Confirmado",
        notes: "",
        photos: [],
      });
      setSelectedAppointmentDetails(null);
      setEditingAppointmentDocId(null);
    }
    setAppointmentModalOpen(true);
  };

  const handleDayHeaderClick = (date) => {
    const formattedDate = date.toISOString().split("T")[0];
    setDailyAppointments(turnos.filter((a) => a.date === formattedDate));
    setSelectedDayForModal(date);
    setDailyModalOpen(true);
  };

  const closeModal = () => {
    setAppointmentModalOpen(false);
    setDailyModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedAppointmentDetails(null);
    setNewAppointment({});
    setEditingAppointmentDocId(null);
    setIsFinishing(false);
    setIsCancelling(false);
    setIsReassigning(false);
    setIsEditing(false);
    setCancelReason("");
    setAppointmentToDelete(null);
  };

  // === LÓGICA DE ACCIONES ===

  const handleAddAppointment = async () => {
    if (newAppointment.patientName && newAppointment.consultorio && newAppointment.treatment) {
      const existing = turnos.some(a => a.date === newAppointment.date && a.time === newAppointment.time && a.consultorio === newAppointment.consultorio);
      if (existing) {
        alert("Ya existe un turno en esa fecha, hora y consultorio.");
        return;
      }
      await addDoc(turnosRef, { ...newAppointment, status: 'Confirmado' });
      closeModal();
    } else {
      alert("Completa todos los campos.");
    }
  };

  const handleUpdateAppointment = async () => {
    if (newAppointment.patientName && newAppointment.consultorio && newAppointment.treatment) {
      const docRef = doc(db, "turnos", editingAppointmentDocId);
      await updateDoc(docRef, { ...newAppointment });
      closeModal();
    } else {
      alert("Completa todos los campos.");
    }
  };

  const handleCancelAppointment = async () => {
    if (cancelReason.trim()) {
      const docRef = doc(db, "turnos", editingAppointmentDocId);
      await updateDoc(docRef, { ...newAppointment, status: "Cancelado", cancelReason });
      closeModal();
    } else {
      alert("Ingresa el motivo de cancelación.");
    }
  };

  const handleSaveFinishedTreatment = async () => {
    const docRef = doc(db, "turnos", editingAppointmentDocId);
    await updateDoc(docRef, { ...newAppointment, status: "Finalizado" });
    closeModal();
  };

  const handleReassignAppointment = async () => {
    if (newAppointment.patientName && newAppointment.consultorio && newAppointment.treatment) {
      const docRef = doc(db, "turnos", editingAppointmentDocId);
      await updateDoc(docRef, { ...newAppointment, status: "Confirmado", cancelReason: "", notes: "", photos: [] });
      closeModal();
    } else {
      alert("Completa todos los campos.");
    }
  };

  const confirmDeleteAppointment = (appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteAppointment = async () => {
    if (!appointmentToDelete) return;
    const docRef = doc(db, "turnos", appointmentToDelete.id);
    await deleteDoc(docRef);
    closeModal();
  };

  const prevWeek = () => setCurrentWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setCurrentWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });

  // === LÓGICA DE RENDERIZADO DEL MODAL ===
  const isAdding = selectedAppointmentDetails === null && !isEditing;
  const isViewing = selectedAppointmentDetails !== null && !isEditing && !isFinishing && !isCancelling && !isReassigning;
  const isCompleted = selectedAppointmentDetails && selectedAppointmentDetails.status === 'Finalizado';
  const isCancelled = selectedAppointmentDetails && selectedAppointmentDetails.status === 'Cancelado';

  const getModalTitle = () => {
    if (isAdding) return "Agendar Nuevo Turno";
    if (isFinishing) return "Finalizar Tratamiento";
    if (isCancelling) return "Cancelar Turno";
    if (isReassigning) return "Reasignar Turno Cancelado";
    if (isEditing) return "Editar Turno";
    return "Detalles del Turno";
  };

  const getModalActions = () => {
    let actions = [];
    const baseAction = { label: "Cerrar", onClick: closeModal, className: "bg-gray-300 text-gray-700 hover:bg-gray-400" };

    if (isAdding) {
      actions = [baseAction, { label: "Agendar", onClick: handleAddAppointment }];
    } else if (isViewing) {
      if (!isCompleted && !isCancelled) {
        actions = [
          baseAction,
          { label: "Editar", onClick: () => setIsEditing(true), className: "bg-yellow-400 text-white hover:bg-yellow-500" },
          { label: "Cancelar", onClick: () => setIsCancelling(true), className: "bg-red-500 text-white hover:bg-red-600" },
          { label: "Eliminar", onClick: () => { confirmDeleteAppointment(selectedAppointmentDetails); setAppointmentModalOpen(false); }, className: "bg-red-500 text-white hover:bg-red-600" },
          { label: "Finalizar", onClick: () => setIsFinishing(true), className: "bg-green-500 text-white hover:bg-green-600" }
        ];
      } else if (isCompleted) {
        actions = [
          baseAction,
          { label: "Actualizar Notas", onClick: () => setIsFinishing(true), className: "bg-green-500 text-white hover:bg-green-600" }
        ];
      } else if (isCancelled) {
        actions = [
          baseAction,
          { label: "Reasignar", onClick: () => setIsReassigning(true), className: "bg-blue-500 text-white hover:bg-blue-600" },
          { label: "Eliminar", onClick: () => { confirmDeleteAppointment(selectedAppointmentDetails); setAppointmentModalOpen(false); }, className: "bg-red-500 text-white hover:bg-red-600" },
        ];
      }
    } else if (isEditing) {
      actions = [baseAction, { label: "Guardar Cambios", onClick: handleUpdateAppointment }];
    } else if (isReassigning) {
      actions = [baseAction, { label: "Reasignar", onClick: handleReassignAppointment }];
    } else if (isFinishing) {
      actions = [baseAction, { label: "Guardar", onClick: handleSaveFinishedTreatment }];
    } else if (isCancelling) {
      actions = [baseAction, { label: "Confirmar", onClick: handleCancelAppointment, className: "bg-red-500 text-white hover:bg-red-600" }];
    }
    return actions;
  };
  
  return (
    <div>
      <h2 className="text-2xl font-semibold text-pink-600 mb-4">Agenda de Turnos</h2>

      <div className="flex justify-between items-center mb-6">
        <button onClick={prevWeek} className="bg-gray-200 p-2 rounded-full hover:bg-gray-300 transition-colors"> &lt; </button>
        <h3 className="text-xl font-bold text-pink-800">
          Semana del {currentWeekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
        </h3>
        <button onClick={nextWeek} className="bg-gray-200 p-2 rounded-full hover:bg-gray-300 transition-colors"> &gt; </button>
      </div>

      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-pink-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
              {getWeekDays().map((day, i) => (
                <th
                  key={i}
                  // ↓↓↓ LA FUNCIÓN ONCLICK FUE AGREGADA AQUÍ ↓↓↓
                  onClick={() => handleDayHeaderClick(day)}
                  className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-pink-100 transition-colors"
                >
                  {weekDays[i]} <br/>
                  <span className="text-sm font-semibold">{day.getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timeSlots.map((time, ti) => (
              <tr key={ti}>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-500">{time}</td>
                {getWeekDays().map((day, di) => {
                  const appointment = isAppointmentBooked(day, time);
                  let cellClass = "bg-gray-100 hover:bg-gray-200 cursor-pointer";
                  if (appointment) {
                    if (appointment.status === 'Finalizado') cellClass = "bg-green-200 text-green-900 cursor-pointer hover:bg-green-300";
                    else if (appointment.status === 'Cancelado') cellClass = "bg-red-400 text-red-950 font-semibold cursor-pointer hover:bg-red-500";
                    else cellClass = "bg-pink-200 text-pink-900 cursor-pointer hover:bg-pink-300";
                  }

                  return (
                    <td key={di} className={`px-2 py-0.5 text-xs text-center border ${cellClass}`} onClick={() => handleSlotClick(day, time)}>
                      {appointment ? (
                        <div>
                          <p className="font-bold">{appointment.patientName}</p>
                          <p>{appointment.treatment}</p>
                          <p>{appointment.consultorio}</p>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal principal */}
      <Modal
        isOpen={appointmentModalOpen}
        onClose={closeModal}
        title={getModalTitle()}
        actions={getModalActions()}
      >
        <div className="flex flex-col gap-4">
          {isViewing ? (
            <div>
              <p><strong>Paciente:</strong> {selectedAppointmentDetails.patientName}</p>
              <p><strong>Fecha:</strong> {new Date(selectedAppointmentDetails.date + 'T00:00:00').toLocaleDateString('es-AR')}</p>
              <p><strong>Hora:</strong> {selectedAppointmentDetails.time}</p>
              <p><strong>Consultorio:</strong> {selectedAppointmentDetails.consultorio}</p>
              <p><strong>Tratamiento:</strong> {selectedAppointmentDetails.treatment}</p>
              {selectedAppointmentDetails.status === 'Cancelado' && <p><strong>Motivo de Cancelación:</strong> {selectedAppointmentDetails.cancelReason}</p>}
              {selectedAppointmentDetails.notes && <p><strong>Notas:</strong> {selectedAppointmentDetails.notes}</p>}
              {selectedAppointmentDetails.photos && selectedAppointmentDetails.photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAppointmentDetails.photos.map((photo, i) => (
                    <img key={i} src={photo} alt={`tratamiento ${i}`} className="w-20 h-20 object-cover rounded" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p><strong>Fecha:</strong> {new Date(newAppointment.date + 'T00:00:00').toLocaleDateString('es-AR')}</p>
              <p><strong>Hora:</strong> {newAppointment.time}</p>
              
              {/* Dropdown de Consultorios */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Consultorio</label>
                <SearchableDropdown
                  options={consultorios}
                  placeholder="Buscar consultorio..."
                  onSelect={(selectedOption) => setNewAppointment({ ...newAppointment, consultorio: selectedOption.name })}
                  value={newAppointment.consultorio || ''}
                />
              </div>

              {/* Dropdown de Pacientes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Paciente</label>
                <SearchableDropdown
                  options={patients}
                  placeholder="Buscar paciente..."
                  onSelect={(selectedOption) => setNewAppointment({ ...newAppointment, patientName: selectedOption.name })}
                  value={newAppointment.patientName || ''}
                />
              </div>

              {/* Dropdown de Tratamientos */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Tratamiento</label>
                <SearchableDropdown
                  options={treatments}
                  placeholder="Buscar tratamiento..."
                  onSelect={(selectedOption) => setNewAppointment({ ...newAppointment, treatment: selectedOption.name })}
                  value={newAppointment.treatment || ''}
                />
              </div>
              
              {isFinishing && (
                <>
                  <textarea placeholder="Notas del tratamiento" className="border p-3 rounded w-full mt-2" value={newAppointment.notes || ''} onChange={e => setNewAppointment({ ...newAppointment, notes: e.target.value })} />
                  <label className="block text-sm font-medium text-gray-700">Subir fotos</label>
                  <input type="file" multiple accept="image/*" onChange={e => {
                    const files = Array.from(e.target.files);
                    files.forEach(file => {
                        const reader = new FileReader();
                        reader.onloadend = () => setNewAppointment(prev => ({ ...prev, photos: [...(prev.photos || []), reader.result] }));
                        reader.readAsDataURL(file);
                    })
                  }} className="p-2 rounded w-full" />
                  <div className="flex flex-wrap gap-2 mt-2">{newAppointment.photos?.map((photo, i) => <img key={i} src={photo} alt={`tratamiento ${i}`} className="w-20 h-20 object-cover rounded" />)}</div>
                </>
              )}

              {isCancelling && (
                <textarea placeholder="Motivo de cancelación" className="border p-3 rounded w-full mt-2" value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal diario */}
      <Modal
        isOpen={dailyModalOpen}
        onClose={closeModal}
        title={selectedDayForModal ? `Turnos del día ${selectedDayForModal.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Turnos del día'}
        actions={[{ label: "Cerrar", onClick: closeModal }]}
      >
        {dailyAppointments.length > 0 ? (
          <ul className="max-h-[60vh] overflow-y-auto">
            {dailyAppointments.map((a) => (
              <li key={a.id} className="bg-gray-100 p-3 mb-2 rounded flex justify-between items-center">
                <div>
                  <div className="font-bold">{a.patientName}</div>
                  <div className="text-sm">Hora: {a.time} | Consultorio: {a.consultorio}</div>
                  <div className="text-sm mt-1"><strong>Estado:</strong> {a.status}</div>
                </div>
                {(a.status === 'Confirmado' || a.status === 'Cancelado') && (
                  <button
                    className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition"
                    onClick={() => {
                      confirmDeleteAppointment(a);
                      setDailyModalOpen(false);
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : <p>No hay turnos agendados para este día.</p>}
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeModal}
        title="Confirmar Eliminación de Turno"
        actions={[
          { label: "Cancelar", onClick: closeModal, className: "bg-gray-300 text-gray-700 hover:bg-gray-400" },
          { label: "Eliminar", onClick: handleConfirmDeleteAppointment, className: "bg-red-500 text-white hover:bg-red-600" }
        ]}
      >
        <p>¿Estás seguro de que quieres eliminar este turno? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
};

export default Agenda;