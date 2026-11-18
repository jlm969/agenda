import { useState, useMemo } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import Modal from "./Modal";
import SearchableDropdown from "./SearchableDropdown";

// === CONSTANTES ===
const START_HOUR = 9;
const END_HOUR = 20;
const WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Turnos de 30 minutos
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
})();

const STATUS_STYLES = {
  Confirmado: { cell: "bg-pink-200 text-pink-900 hover:bg-pink-300", chip: "bg-pink-200 text-pink-900" },
  Finalizado: { cell: "bg-green-200 text-green-900 hover:bg-green-300", chip: "bg-green-200 text-green-900" },
  Cancelado: { cell: "bg-red-300 text-red-950 font-semibold hover:bg-red-400", chip: "bg-red-300 text-red-950" },
};

const turnosRef = collection(db, "turnos");

// === HELPERS ===
// Fecha local en formato YYYY-MM-DD (sin pasar por UTC)
const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Lunes de la semana de la fecha dada
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDate = (key) => (key ? new Date(key + "T00:00:00").toLocaleDateString("es-AR") : "");

// Evita guardar el campo "id" dentro del documento de Firestore
const withoutId = ({ id, ...rest }) => rest;

const isComplete = (a) => Boolean(a.patientName && a.consultorio && a.treatment);

const Agenda = ({ patients, turnos = [], consultorios, treatments }) => {
  // === ESTADOS ===
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({});
  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState(null);
  const [editingAppointmentDocId, setEditingAppointmentDocId] = useState(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [selectedDayForModal, setSelectedDayForModal] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

  // === DATOS DERIVADOS ===
  const weekDates = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [currentWeekStart]
  );

  // Un turno por celda (fecha + hora), armado una sola vez por cambio de datos
  const turnosBySlot = useMemo(() => {
    const map = new Map();
    turnos.forEach((t) => {
      const key = `${t.date}|${t.time}`;
      if (!map.has(key)) map.set(key, t);
    });
    return map;
  }, [turnos]);

  const dailyAppointments = useMemo(() => {
    if (!selectedDayForModal) return [];
    const key = toDateKey(selectedDayForModal);
    return turnos
      .filter((a) => a.date === key)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [turnos, selectedDayForModal]);

  const todayKey = toDateKey(new Date());
  const isCurrentWeek = toDateKey(currentWeekStart) === toDateKey(getStartOfWeek(new Date()));

  const weekLabel = (() => {
    const start = weekDates[0];
    const end = weekDates[5];
    const startMonth = start.toLocaleDateString("es-AR", { month: "long" });
    const endMonth = end.toLocaleDateString("es-AR", { month: "long" });
    return startMonth === endMonth
      ? `${start.getDate()} al ${end.getDate()} de ${endMonth}`
      : `${start.getDate()} de ${startMonth} al ${end.getDate()} de ${endMonth}`;
  })();

  const getAppointment = (day, time) => turnosBySlot.get(`${toDateKey(day)}|${time}`);

  // === MODALES ===
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

  const handleSlotClick = (day, time) => {
    const existingAppointment = getAppointment(day, time);

    closeModal();

    if (existingAppointment) {
      setSelectedAppointmentDetails(existingAppointment);
      setNewAppointment({ ...existingAppointment });
      setEditingAppointmentDocId(existingAppointment.id);
      setCancelReason(existingAppointment.cancelReason || "");
    } else {
      setNewAppointment({
        date: toDateKey(day),
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
    setSelectedDayForModal(date);
    setDailyModalOpen(true);
  };

  const confirmDeleteAppointment = (appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteModalOpen(true);
  };

  // === ACCIONES CON FIREBASE ===
  // Evita dobles clics y avisa si algo falla (sin internet, permisos, etc.)
  const runAction = async (action) => {
    if (saving) return;
    setSaving(true);
    try {
      await action();
    } catch (error) {
      console.error("Error en la agenda:", error);
      alert("No se pudo completar la acción. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAppointment = () => {
    if (!isComplete(newAppointment)) {
      alert("Completá paciente, consultorio y tratamiento.");
      return;
    }
    const taken = turnos.some(
      (a) =>
        a.date === newAppointment.date &&
        a.time === newAppointment.time &&
        a.consultorio === newAppointment.consultorio
    );
    if (taken) {
      alert("Ya existe un turno en esa fecha, hora y consultorio.");
      return;
    }
    runAction(async () => {
      await addDoc(turnosRef, { ...withoutId(newAppointment), status: "Confirmado" });
      closeModal();
    });
  };

  const handleUpdateAppointment = () => {
    if (!isComplete(newAppointment)) {
      alert("Completá paciente, consultorio y tratamiento.");
      return;
    }
    runAction(async () => {
      await updateDoc(doc(db, "turnos", editingAppointmentDocId), withoutId(newAppointment));
      closeModal();
    });
  };

  const handleCancelAppointment = () => {
    if (!cancelReason.trim()) {
      alert("Ingresá el motivo de cancelación.");
      return;
    }
    runAction(async () => {
      await updateDoc(doc(db, "turnos", editingAppointmentDocId), {
        ...withoutId(newAppointment),
        status: "Cancelado",
        cancelReason: cancelReason.trim(),
      });
      closeModal();
    });
  };

  const handleSaveFinishedTreatment = () => {
    runAction(async () => {
      await updateDoc(doc(db, "turnos", editingAppointmentDocId), {
        ...withoutId(newAppointment),
        status: "Finalizado",
      });
      closeModal();
    });
  };

  const handleReassignAppointment = () => {
    if (!isComplete(newAppointment)) {
      alert("Completá paciente, consultorio y tratamiento.");
      return;
    }
    runAction(async () => {
      await updateDoc(doc(db, "turnos", editingAppointmentDocId), {
        ...withoutId(newAppointment),
        status: "Confirmado",
        cancelReason: "",
        notes: "",
        photos: [],
      });
      closeModal();
    });
  };

  const handleConfirmDeleteAppointment = () => {
    if (!appointmentToDelete) return;
    runAction(async () => {
      await deleteDoc(doc(db, "turnos", appointmentToDelete.id));
      closeModal();
    });
  };

  // === NAVEGACIÓN DE SEMANAS ===
  const shiftWeek = (days) =>
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  const goToCurrentWeek = () => setCurrentWeekStart(getStartOfWeek(new Date()));

  // === LÓGICA DE RENDERIZADO DEL MODAL ===
  const isAdding = selectedAppointmentDetails === null && !isEditing;
  const isViewing =
    selectedAppointmentDetails !== null && !isEditing && !isFinishing && !isCancelling && !isReassigning;
  const isCompleted = selectedAppointmentDetails && selectedAppointmentDetails.status === "Finalizado";
  const isCancelled = selectedAppointmentDetails && selectedAppointmentDetails.status === "Cancelado";

  const getModalTitle = () => {
    if (isAdding) return "Agendar nuevo turno";
    if (isFinishing) return "Finalizar tratamiento";
    if (isCancelling) return "Cancelar turno";
    if (isReassigning) return "Reasignar turno cancelado";
    if (isEditing) return "Editar turno";
    return "Detalles del turno";
  };

  const getModalActions = () => {
    let actions = [];
    const baseAction = { label: "Cerrar", onClick: closeModal, className: "bg-gray-300 text-gray-700 hover:bg-gray-400" };
    const deleteAction = {
      label: "Eliminar",
      onClick: () => {
        confirmDeleteAppointment(selectedAppointmentDetails);
        setAppointmentModalOpen(false);
      },
      className: "bg-red-500 text-white hover:bg-red-600",
    };

    if (isAdding) {
      actions = [baseAction, { label: "Agendar", onClick: handleAddAppointment }];
    } else if (isViewing) {
      if (!isCompleted && !isCancelled) {
        actions = [
          baseAction,
          { label: "Editar", onClick: () => setIsEditing(true), className: "bg-yellow-400 text-white hover:bg-yellow-500" },
          { label: "Cancelar turno", onClick: () => setIsCancelling(true), className: "bg-red-500 text-white hover:bg-red-600" },
          deleteAction,
          { label: "Finalizar", onClick: () => setIsFinishing(true), className: "bg-green-500 text-white hover:bg-green-600" },
        ];
      } else if (isCompleted) {
        actions = [
          baseAction,
          { label: "Actualizar notas", onClick: () => setIsFinishing(true), className: "bg-green-500 text-white hover:bg-green-600" },
        ];
      } else if (isCancelled) {
        actions = [
          baseAction,
          { label: "Reasignar", onClick: () => setIsReassigning(true), className: "bg-blue-500 text-white hover:bg-blue-600" },
          deleteAction,
        ];
      }
    } else if (isEditing) {
      actions = [baseAction, { label: "Guardar cambios", onClick: handleUpdateAppointment }];
    } else if (isReassigning) {
      actions = [baseAction, { label: "Reasignar", onClick: handleReassignAppointment }];
    } else if (isFinishing) {
      actions = [baseAction, { label: "Guardar", onClick: handleSaveFinishedTreatment }];
    } else if (isCancelling) {
      actions = [baseAction, { label: "Confirmar cancelación", onClick: handleCancelAppointment, className: "bg-red-500 text-white hover:bg-red-600" }];
    }
    return actions;
  };

  return (
    <div>
      {/* Encabezado y referencias de color */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-semibold text-pink-600">Agenda de turnos</h2>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          {Object.entries(STATUS_STYLES).map(([status, style]) => (
            <span key={status} className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded ${style.chip}`} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Navegación de semanas */}
      <div className="flex items-center justify-between gap-2 mb-4 bg-white rounded-lg shadow-sm px-3 py-2">
        <button
          onClick={() => shiftWeek(-7)}
          aria-label="Semana anterior"
          className="bg-gray-200 w-9 h-9 rounded-full hover:bg-gray-300 transition-colors"
        >
          &lsaquo;
        </button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-pink-800">Semana del {weekLabel}</h3>
          {!isCurrentWeek && (
            <button onClick={goToCurrentWeek} className="text-xs text-pink-600 underline hover:text-pink-800">
              Volver a esta semana
            </button>
          )}
        </div>
        <button
          onClick={() => shiftWeek(7)}
          aria-label="Semana siguiente"
          className="bg-gray-200 w-9 h-9 rounded-full hover:bg-gray-300 transition-colors"
        >
          &rsaquo;
        </button>
      </div>

      {/* Grilla semanal */}
      <div className="isolate overflow-auto max-h-[70vh] rounded-lg shadow-sm bg-white">
        <table className="min-w-[760px] w-full divide-y divide-gray-200 table-fixed">
          <thead>
            <tr>
              <th className="w-16 px-3 py-2 text-left text-xs font-medium text-gray-500 sticky top-0 left-0 bg-pink-50 z-30">
                Hora
              </th>
              {weekDates.map((day, i) => {
                const isToday = toDateKey(day) === todayKey;
                return (
                  <th
                    key={i}
                    onClick={() => handleDayHeaderClick(day)}
                    title="Ver los turnos del día"
                    className={`px-3 py-2 text-center text-xs font-medium cursor-pointer transition-colors sticky top-0 z-20 ${
                      isToday ? "bg-pink-200 text-pink-900" : "bg-pink-50 text-gray-500 hover:bg-pink-100"
                    }`}
                  >
                    {WEEKDAY_NAMES[i]}
                    <br />
                    <span className="text-sm font-semibold">{day.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {TIME_SLOTS.map((time) => (
              <tr key={time}>
                <td
                  className={`px-3 py-1 whitespace-nowrap text-sm sticky left-0 bg-white z-10 ${
                    time.endsWith(":30") ? "text-gray-400" : "text-gray-600 font-medium"
                  }`}
                >
                  {time}
                </td>
                {weekDates.map((day, di) => {
                  const appointment = getAppointment(day, time);
                  const style = appointment ? STATUS_STYLES[appointment.status] || STATUS_STYLES.Confirmado : null;
                  const cellClass = style ? style.cell : "bg-gray-100 hover:bg-pink-50";

                  return (
                    <td
                      key={di}
                      className={`group h-11 px-2 py-0.5 text-xs text-center border cursor-pointer transition-colors ${cellClass}`}
                      onClick={() => handleSlotClick(day, time)}
                    >
                      {appointment ? (
                        <div className="leading-tight">
                          <p className="font-bold truncate">{appointment.patientName}</p>
                          <p className="truncate">{appointment.treatment}</p>
                          <p className="truncate opacity-75">{appointment.consultorio}</p>
                        </div>
                      ) : (
                        <span className="text-base text-pink-300 opacity-0 group-hover:opacity-100">+</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal principal */}
      <Modal isOpen={appointmentModalOpen} onClose={closeModal} title={getModalTitle()} actions={getModalActions()}>
        <div className="flex flex-col gap-4">
          {isViewing ? (
            <div>
              <p><strong>Paciente:</strong> {selectedAppointmentDetails.patientName}</p>
              <p><strong>Fecha:</strong> {formatDate(selectedAppointmentDetails.date)}</p>
              <p><strong>Hora:</strong> {selectedAppointmentDetails.time}</p>
              <p><strong>Consultorio:</strong> {selectedAppointmentDetails.consultorio}</p>
              <p><strong>Tratamiento:</strong> {selectedAppointmentDetails.treatment}</p>
              <p><strong>Estado:</strong> {selectedAppointmentDetails.status}</p>
              {selectedAppointmentDetails.status === "Cancelado" && (
                <p><strong>Motivo de cancelación:</strong> {selectedAppointmentDetails.cancelReason}</p>
              )}
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
              <p><strong>Fecha:</strong> {formatDate(newAppointment.date)}</p>
              <p><strong>Hora:</strong> {newAppointment.time}</p>

              {/* Dropdown de Consultorios */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Consultorio</label>
                <SearchableDropdown
                  options={consultorios}
                  placeholder="Buscar consultorio..."
                  onSelect={(selectedOption) => setNewAppointment({ ...newAppointment, consultorio: selectedOption.name })}
                  value={newAppointment.consultorio || ""}
                />
              </div>

              {/* Dropdown de Pacientes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Paciente</label>
                <SearchableDropdown
                  options={patients}
                  placeholder="Buscar paciente..."
                  onSelect={(selectedOption) => setNewAppointment({ ...newAppointment, patientName: selectedOption.name })}
                  value={newAppointment.patientName || ""}
                />
              </div>

              {/* Dropdown de Tratamientos */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Tratamiento</label>
                <SearchableDropdown
                  options={treatments}
                  placeholder="Buscar tratamiento..."
                  onSelect={(selectedOption) => setNewAppointment({ ...newAppointment, treatment: selectedOption.name })}
                  value={newAppointment.treatment || ""}
                />
              </div>

              {isFinishing && (
                <>
                  <textarea
                    placeholder="Notas del tratamiento"
                    className="border p-3 rounded w-full mt-2"
                    value={newAppointment.notes || ""}
                    onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                  />
                  <label className="block text-sm font-medium text-gray-700">Subir fotos</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      files.forEach((file) => {
                        const reader = new FileReader();
                        reader.onloadend = () =>
                          setNewAppointment((prev) => ({ ...prev, photos: [...(prev.photos || []), reader.result] }));
                        reader.readAsDataURL(file);
                      });
                    }}
                    className="p-2 rounded w-full"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newAppointment.photos?.map((photo, i) => (
                      <img key={i} src={photo} alt={`tratamiento ${i}`} className="w-20 h-20 object-cover rounded" />
                    ))}
                  </div>
                </>
              )}

              {isCancelling && (
                <textarea
                  placeholder="Motivo de cancelación"
                  className="border p-3 rounded w-full mt-2"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal diario */}
      <Modal
        isOpen={dailyModalOpen}
        onClose={closeModal}
        title={
          selectedDayForModal
            ? `Turnos del día ${selectedDayForModal.toLocaleDateString("es-AR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}`
            : "Turnos del día"
        }
        actions={[{ label: "Cerrar", onClick: closeModal }]}
      >
        {dailyAppointments.length > 0 ? (
          <ul className="max-h-[60vh] overflow-y-auto">
            {dailyAppointments.map((a) => (
              <li key={a.id} className="bg-gray-100 p-3 mb-2 rounded flex justify-between items-center gap-3">
                <div>
                  <div className="font-bold">{a.patientName}</div>
                  <div className="text-sm">
                    {a.time} &middot; {a.treatment} &middot; {a.consultorio}
                  </div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                      (STATUS_STYLES[a.status] || STATUS_STYLES.Confirmado).chip
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                {(a.status === "Confirmado" || a.status === "Cancelado") && (
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
        ) : (
          <p>No hay turnos agendados para este día.</p>
        )}
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeModal}
        title="Confirmar eliminación de turno"
        actions={[
          { label: "Cancelar", onClick: closeModal, className: "bg-gray-300 text-gray-700 hover:bg-gray-400" },
          { label: "Eliminar", onClick: handleConfirmDeleteAppointment, className: "bg-red-500 text-white hover:bg-red-600" },
        ]}
      >
        <p>¿Seguro que querés eliminar este turno? Esta acción no se puede deshacer.</p>
      </Modal>
    </div>
  );
};

export default Agenda;
