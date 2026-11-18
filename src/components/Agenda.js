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

// === WHATSAPP ===
const CLINIC_NAME = "Liset Herzog - Medicina Estética";
// Código de área del consultorio, sin 0 ni 15 (ej. "3464"). Se usa solo si el teléfono
// guardado no trae el código de área. Dejar vacío ("") si todos los teléfonos lo traen.
const DEFAULT_AREA_CODE = "";

// Convierte un teléfono argentino escrito de cualquier forma al formato que pide WhatsApp
// (549 + código de área + número, sin 0 ni 15). Devuelve null si no se puede armar.
const toWhatsAppNumber = (raw) => {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);

  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  } else if (d.startsWith("0")) {
    d = d.slice(1);
  } else if (d.length === 11 && d.startsWith("9")) {
    d = d.slice(1);
  } else if (d.length > 10) {
    return d; // otro país: se asume que ya trae el código internacional
  }

  // Número local sin código de área: se completa con el del consultorio
  if (d.length < 10 && DEFAULT_AREA_CODE) {
    const a = DEFAULT_AREA_CODE.length;
    if (d.length === 10 - a) d = DEFAULT_AREA_CODE + d;
    else if (d.startsWith("15") && d.length === 12 - a) d = DEFAULT_AREA_CODE + d.slice(2);
  }

  // Con el 15 de celular (12 dígitos): se quita
  if (d.length === 12) {
    const areaLengths = d.startsWith("11") ? [2] : [3, 4];
    for (const a of areaLengths) {
      if (d.slice(a, a + 2) === "15") {
        d = d.slice(0, a) + d.slice(a + 2);
        break;
      }
    }
  }

  return d.length === 10 ? `549${d}` : null;
};

// Arma el link de WhatsApp para un turno (o el motivo por el que no se puede)
const getWhatsApp = (appointment, patients) => {
  const name = (appointment.patientName || "").trim().toLowerCase();
  const patient = (patients || []).find((p) => (p.name || "").trim().toLowerCase() === name);
  if (!patient || !String(patient.phone || "").trim()) return { error: "Sin teléfono guardado" };

  const number = toWhatsAppNumber(patient.phone);
  if (!number) return { error: "Teléfono incompleto: falta el código de área" };

  const day = new Date(appointment.date + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const text =
    `Hola ${appointment.patientName}, te escribimos de ${CLINIC_NAME} por tu turno de ` +
    `${appointment.treatment}: ${day} a las ${appointment.time}. ¿Nos confirmás que podés asistir? ¡Gracias!`;
  return { url: `https://wa.me/${number}?text=${encodeURIComponent(text)}` };
};

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
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
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

  // Horarios libres del día elegido para reprogramar (la agenda no atiende los domingos)
  const isSundayChosen = Boolean(newDate) && new Date(newDate + "T00:00:00").getDay() === 0;
  const availableTimes = useMemo(() => {
    if (!isRescheduling || !newDate || isSundayChosen) return [];
    return TIME_SLOTS.filter((t) => !turnosBySlot.has(`${newDate}|${t}`));
  }, [isRescheduling, newDate, isSundayChosen, turnosBySlot]);

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

  // Próximo día de atención (el sábado, el lunes; si no, mañana)
  const daysToNextWorkDay = new Date().getDay() === 6 ? 2 : 1;
  const nextWorkDay = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysToNextWorkDay);
    return d;
  })();
  const nextWorkDayLabel = daysToNextWorkDay === 1 ? "mañana" : "el lunes";

  // Deja registrado que se abrió WhatsApp para avisar al paciente
  const markReminderSent = async (appointment) => {
    try {
      await updateDoc(doc(db, "turnos", appointment.id), { reminderSentAt: Date.now() });
    } catch (error) {
      console.error("No se pudo registrar el aviso:", error);
    }
  };

  // Botón de WhatsApp (o el motivo por el que no está disponible)
  const renderWhatsApp = (appointment) => {
    const { url, error } = getWhatsApp(appointment, patients);
    if (error) return <span className="text-xs text-gray-500">{error}</span>;

    const live = turnos.find((t) => t.id === appointment.id) || appointment;
    const sentAt = live.reminderSentAt;
    return (
      <>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => markReminderSent(appointment)}
          className="inline-block bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition"
        >
          {sentAt ? "Enviar de nuevo" : "Enviar WhatsApp"}
        </a>
        {sentAt && (
          <span className="text-xs text-green-700">
            Enviado el{" "}
            {new Date(sentAt).toLocaleString("es-AR", {
              day: "numeric",
              month: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </>
    );
  };

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
    setIsRescheduling(false);
    setNewDate("");
    setNewTime("");
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

  const handleRescheduleAppointment = () => {
    if (!newDate || !newTime) {
      alert("Elegí la nueva fecha y el nuevo horario.");
      return;
    }
    if (newDate < todayKey) {
      alert("No se puede reprogramar a una fecha pasada.");
      return;
    }
    if (turnosBySlot.has(`${newDate}|${newTime}`)) {
      alert("Ese horario ya está ocupado.");
      return;
    }
    runAction(async () => {
      // Solo cambia fecha y hora; el resto del turno queda igual
      await updateDoc(doc(db, "turnos", editingAppointmentDocId), {
        date: newDate,
        time: newTime,
        reminderSentAt: null,
      });
      setCurrentWeekStart(getStartOfWeek(new Date(newDate + "T00:00:00")));
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
    selectedAppointmentDetails !== null &&
    !isEditing &&
    !isFinishing &&
    !isCancelling &&
    !isReassigning &&
    !isRescheduling;
  const isCompleted = selectedAppointmentDetails && selectedAppointmentDetails.status === "Finalizado";
  const isCancelled = selectedAppointmentDetails && selectedAppointmentDetails.status === "Cancelado";

  const getModalTitle = () => {
    if (isAdding) return "Agendar nuevo turno";
    if (isFinishing) return "Finalizar tratamiento";
    if (isCancelling) return "Cancelar turno";
    if (isReassigning) return "Reasignar turno cancelado";
    if (isRescheduling) return "Reprogramar turno";
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
          {
            label: "Reprogramar",
            onClick: () => {
              setNewDate(selectedAppointmentDetails.date);
              setNewTime("");
              setIsRescheduling(true);
            },
            className: "bg-blue-500 text-white hover:bg-blue-600",
          },
          { label: "Cancelar", onClick: () => setIsCancelling(true), className: "bg-red-500 text-white hover:bg-red-600" },
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
    } else if (isRescheduling) {
      actions = [baseAction, { label: "Reprogramar", onClick: handleRescheduleAppointment }];
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

      <button
        onClick={() => handleDayHeaderClick(nextWorkDay)}
        className="mb-4 w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
      >
        Recordatorios para {nextWorkDayLabel}
      </button>

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
              {selectedAppointmentDetails.status === "Confirmado" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {renderWhatsApp(selectedAppointmentDetails)}
                </div>
              )}
              {selectedAppointmentDetails.photos && selectedAppointmentDetails.photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAppointmentDetails.photos.map((photo, i) => (
                    <img key={i} src={photo} alt={`tratamiento ${i}`} className="w-20 h-20 object-cover rounded" />
                  ))}
                </div>
              )}
            </div>
          ) : isRescheduling ? (
            <div className="flex flex-col gap-3">
              <p><strong>Paciente:</strong> {selectedAppointmentDetails?.patientName}</p>
              <p>
                <strong>Turno actual:</strong> {formatDate(selectedAppointmentDetails?.date)} a las{" "}
                {selectedAppointmentDetails?.time}
              </p>
              <div>
                <label htmlFor="nueva-fecha" className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva fecha
                </label>
                <input
                  id="nueva-fecha"
                  type="date"
                  min={todayKey}
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    setNewTime("");
                  }}
                  className="border p-3 rounded w-full"
                />
              </div>
              <div>
                <label htmlFor="nuevo-horario" className="block text-sm font-medium text-gray-700 mb-1">
                  Nuevo horario
                </label>
                {!newDate ? (
                  <p className="text-sm text-gray-500">Elegí primero la fecha.</p>
                ) : isSundayChosen ? (
                  <p className="text-sm text-red-600">Los domingos no hay agenda. Elegí otro día.</p>
                ) : availableTimes.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay horarios libres ese día.</p>
                ) : (
                  <select
                    id="nuevo-horario"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="border p-3 rounded w-full bg-white"
                  >
                    <option value="">Elegí un horario</option>
                    {availableTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
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
                  {a.status === "Confirmado" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">{renderWhatsApp(a)}</div>
                  )}
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
