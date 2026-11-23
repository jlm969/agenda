import { useState, useMemo, useEffect, useRef } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { AiOutlineSetting } from "react-icons/ai";
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

// Busca la ficha del paciente por el nombre que figura en el turno
const findPatient = (patients, name) => {
  const key = (name || "").trim().toLowerCase();
  return (patients || []).find((p) => (p.name || "").trim().toLowerCase() === key) || null;
};

// Momento exacto (en milisegundos) en que empieza un turno
const slotTime = (dateKey, time) => new Date(`${dateKey}T${time}:00`).getTime();

// "19/11 16:30" (hora de 24 horas)
const formatDayTime = (ms) => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`;
};

// El recordatorio se puede enviar en cualquier momento, salvo que el turno ya haya pasado
const getReminderWindow = (appointment, now) =>
  slotTime(appointment.date, appointment.time) <= now
    ? { open: false, reason: "El turno ya pasó: no se puede enviar el recordatorio" }
    : { open: true };

// --- Mensaje editable ---
// Se guarda en este navegador; si no hay uno guardado, se usa el mensaje original.
const TEMPLATE_KEY = "agenda_lh_mensaje_recordatorio";

const DEFAULT_TEMPLATE = `Hola {paciente}, te escribimos de {clinica} por tu turno de {tratamiento}: {dia} a las {hora}.

📍 {lugar}
{direccion}
Cómo llegar: {mapa}

¿Nos confirmás que podés asistir? ¡Gracias!`;

// Datos que se pueden insertar en el mensaje: { nombre }
const PLACEHOLDERS = [
  { key: "paciente", label: "Paciente" },
  { key: "tratamiento", label: "Tratamiento" },
  { key: "dia", label: "Día" },
  { key: "hora", label: "Hora" },
  { key: "clinica", label: "Nombre del centro" },
  { key: "lugar", label: "Lugar" },
  { key: "direccion", label: "Dirección" },
  { key: "mapa", label: "Link de Maps" },
];

// Secciones de la ventana de configuración (para sumar más en el futuro)
const SETTINGS_TABS = [
  { id: "message", label: "Mensaje" },
  { id: "places", label: "Lugares" },
];

const loadTemplate = () => {
  try {
    return localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
  } catch (error) {
    return DEFAULT_TEMPLATE;
  }
};

// Dirección completa: calle y número, ciudad y provincia (solo lo que esté cargado)
const buildAddress = (place) =>
  [place?.address, place?.city, place?.province]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");

// Link de Google Maps: el que se haya pegado, o uno armado con la dirección
const buildMapsUrl = (place) => {
  const custom = String(place?.mapsUrl || "").trim();
  if (custom) return custom;
  const address = buildAddress(place);
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Argentina`)}`
    : "";
};

// Reemplaza los {datos} del mensaje. Si una línea solo tiene datos que no están cargados
// (por ejemplo, la dirección de un consultorio sin dirección), esa línea se omite.
const buildMessage = (template, appointment, consultorios) => {
  const consultorioName = (appointment.consultorio || "").trim().toLowerCase();
  const place = (consultorios || []).find((c) => (c.name || "").trim().toLowerCase() === consultorioName);

  const values = {
    paciente: appointment.patientName || "",
    tratamiento: appointment.treatment || "",
    dia: new Date(appointment.date + "T00:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    hora: appointment.time || "",
    clinica: CLINIC_NAME,
    lugar: (place && place.name) || appointment.consultorio || "",
    direccion: buildAddress(place),
    mapa: buildMapsUrl(place),
  };

  const lines = template.split("\n").map((line) => {
    let hasData = false;
    let anyFilled = false;
    const out = line.replace(/\{(\w+)\}/g, (match, key) => {
      if (!(key in values)) return match; // dato desconocido: se deja tal cual para que se note
      hasData = true;
      if (values[key]) anyFilled = true;
      return values[key];
    });
    return hasData && !anyFilled ? null : out;
  });

  return lines.filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

// Arma el link de WhatsApp para un turno (o indica qué falta)
const getWhatsApp = (appointment, patients, template, consultorios) => {
  const patient = findPatient(patients, appointment.patientName);
  if (!patient) return { error: "No se encontró la ficha de este paciente en Pacientes" };

  const phone = String(patient.phone || "").trim();
  if (!phone) return { patient, needsPhone: true, error: "Este paciente no tiene teléfono guardado" };

  const number = toWhatsAppNumber(phone);
  if (!number) {
    return { patient, needsPhone: true, error: `El teléfono guardado (${phone}) está incompleto: falta el código de área` };
  }

  const text = buildMessage(template, appointment, consultorios);
  return { patient, url: `https://wa.me/${number}?text=${encodeURIComponent(text)}` };
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

  // Hora actual, se actualiza cada minuto para que los avisos y horarios no queden desactualizados
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Arrastrar y soltar turnos
  const [draggingId, setDraggingId] = useState(null);
  const [moveConfirm, setMoveConfirm] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  // Teléfonos que se están escribiendo desde la ventana del turno (por turno)
  const [phoneDrafts, setPhoneDrafts] = useState({});

  // Mensaje del recordatorio (editable) y datos de los lugares
  const [template, setTemplate] = useState(loadTemplate);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("message");
  const [templateDraft, setTemplateDraft] = useState("");
  const templateRef = useRef(null);

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
    return TIME_SLOTS.filter((t) => !turnosBySlot.has(`${newDate}|${t}`) && slotTime(newDate, t) > now);
  }, [isRescheduling, newDate, isSundayChosen, turnosBySlot, now]);

  const dailyAppointments = useMemo(() => {
    if (!selectedDayForModal) return [];
    const key = toDateKey(selectedDayForModal);
    return turnos
      .filter((a) => a.date === key)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [turnos, selectedDayForModal]);

  const todayKey = toDateKey(new Date(now));
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

  // Guarda en la ficha del paciente el teléfono escrito desde la ventana del turno
  const savePatientPhone = (appointment, patient) => {
    const phone = String(phoneDrafts[appointment.id] ?? patient.phone ?? "").trim();
    if (!toWhatsAppNumber(phone)) {
      alert("El teléfono no es válido. Escribí el código de área y el número, sin 0 ni 15.");
      return;
    }
    runAction(async () => {
      await updateDoc(doc(db, "pacientes", patient.id), { phone });
      setPhoneDrafts((prev) => {
        const next = { ...prev };
        delete next[appointment.id];
        return next;
      });
    });
  };

  // Botón de WhatsApp, o el motivo por el que no está disponible
  const renderWhatsApp = (appointment) => {
    const live = turnos.find((t) => t.id === appointment.id) || appointment;
    const sentAt = live.reminderSentAt;
    const sentInfo = sentAt ? (
      <span className="text-xs text-green-700">Enviado el {formatDayTime(sentAt)}</span>
    ) : null;

    // Turno que ya pasó: no se ofrece el envío (y no se muestra ninguna leyenda)
    const reminder = getReminderWindow(appointment, now);
    if (!reminder.open) return sentInfo;

    const { url, error, needsPhone, patient } = getWhatsApp(appointment, patients, template, consultorios);

    // Falta el teléfono: se pide acá mismo y se guarda en la ficha del paciente
    if (needsPhone) {
      const draft = phoneDrafts[appointment.id] ?? patient.phone ?? "";
      return (
        <div className="w-full">
          <p className="text-xs text-gray-600 mb-1">{error}</p>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              placeholder="Código de área y número"
              value={draft}
              onChange={(e) => setPhoneDrafts((prev) => ({ ...prev, [appointment.id]: e.target.value }))}
              className="border p-2 rounded flex-1 min-w-0 text-sm"
            />
            <button
              onClick={() => savePatientPhone(appointment, patient)}
              className="bg-pink-500 text-white px-3 py-2 rounded text-sm hover:bg-pink-600 transition"
            >
              Guardar teléfono
            </button>
          </div>
        </div>
      );
    }

    if (error) return <span className="text-xs text-gray-500">{error}</span>;

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
        {sentInfo}
      </>
    );
  };

  // === EDITOR DEL MENSAJE ===
  const openSettings = () => {
    setTemplateDraft(template);
    setSettingsTab("message");
    setSettingsOpen(true);
  };
  const closeSettings = () => setSettingsOpen(false);

  const saveTemplate = () => {
    const text = templateDraft.trim();
    if (!text) {
      alert("El mensaje no puede quedar vacío.");
      return;
    }
    setTemplate(text);
    try {
      localStorage.setItem(TEMPLATE_KEY, text);
    } catch (error) {
      alert("No se pudo guardar el mensaje en este navegador. Se va a usar hasta que cierres la app.");
    }
    closeSettings();
  };

  // Inserta un dato (ej. {paciente}) donde está el cursor
  const insertPlaceholder = (key) => {
    const token = `{${key}}`;
    const el = templateRef.current;
    if (!el) {
      setTemplateDraft((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? templateDraft.length;
    const end = el.selectionEnd ?? templateDraft.length;
    setTemplateDraft(templateDraft.slice(0, start) + token + templateDraft.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  // Turno de ejemplo para la vista previa: el próximo confirmado, o uno inventado
  const sampleAppointment =
    turnos
      .filter((t) => t.status === "Confirmado" && slotTime(t.date, t.time) > now)
      .sort((a, b) => slotTime(a.date, a.time) - slotTime(b.date, b.time))[0] || {
      patientName: "María Pérez",
      treatment: "Tratamiento",
      date: toDateKey(new Date(now + 24 * 60 * 60 * 1000)),
      time: "10:00",
      consultorio: (consultorios && consultorios[0] && consultorios[0].name) || "",
    };

  // === ARRASTRAR Y SOLTAR ===
  // Un horario sirve como destino si está libre y todavía no pasó
  const canMoveTo = (dateKey, time) => !turnosBySlot.has(`${dateKey}|${time}`) && slotTime(dateKey, time) > now;

  const handleDropOnSlot = (day, time) => {
    const appointment = turnos.find((t) => t.id === draggingId);
    setDraggingId(null);
    setDropTarget(null);
    const dateKey = toDateKey(day);
    if (!appointment || !canMoveTo(dateKey, time)) return;

    const fmt = { weekday: "long", day: "numeric", month: "long" };
    setMoveConfirm({
      appointment,
      dateKey,
      time,
      from: `${new Date(appointment.date + "T00:00:00").toLocaleDateString("es-AR", fmt)} a las ${appointment.time}`,
      to: `${day.toLocaleDateString("es-AR", fmt)} a las ${time}`,
    });
  };

  const confirmMove = () => {
    if (!moveConfirm) return;
    const { appointment, dateKey, time } = moveConfirm;
    runAction(async () => {
      await updateDoc(doc(db, "turnos", appointment.id), { date: dateKey, time, reminderSentAt: null });
      setMoveConfirm(null);
    });
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
    if (slotTime(newDate, newTime) <= Date.now()) {
      alert("No se puede reprogramar a un horario que ya pasó.");
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
      className: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
    };

    if (isAdding) {
      actions = [baseAction, { label: "Agendar", onClick: handleAddAppointment }];
    } else if (isViewing) {
      if (!isCompleted && !isCancelled) {
        actions = [
          baseAction,
          { label: "Editar", onClick: () => setIsEditing(true), className: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50" },
          {
            label: "Reprogramar",
            onClick: () => {
              setNewDate(selectedAppointmentDetails.date);
              setNewTime("");
              setIsRescheduling(true);
            },
            className: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
          },
          { label: "Cancelar", onClick: () => setIsCancelling(true), className: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" },
          deleteAction,
          { label: "Finalizar", onClick: () => setIsFinishing(true), className: "bg-pink-500 text-white hover:bg-pink-600" },
        ];
      } else if (isCompleted) {
        actions = [
          baseAction,
          { label: "Actualizar notas", onClick: () => setIsFinishing(true), className: "bg-pink-500 text-white hover:bg-pink-600" },
        ];
      } else if (isCancelled) {
        actions = [
          baseAction,
          { label: "Reasignar", onClick: () => setIsReassigning(true), className: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50" },
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
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-2xl font-semibold text-pink-600">Agenda de turnos</h2>
        <button
          onClick={openSettings}
          aria-label="Configuración"
          title="Configuración"
          className="p-2 rounded-full text-pink-700 hover:bg-pink-100 transition-colors"
        >
          <AiOutlineSetting className="h-6 w-6" />
        </button>
      </div>

      {/* Referencias de color */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-4">
        {Object.entries(STATUS_STYLES).map(([status, style]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded ${style.chip}`} />
            {status}
          </span>
        ))}
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

      <p className="hidden md:block text-xs text-gray-500 mb-2">
        Con el mouse podés arrastrar un turno confirmado a otro horario libre, del mismo día o de otro día de esta semana.
      </p>

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
                  const dateKey = toDateKey(day);
                  const slotKey = `${dateKey}|${time}`;
                  const appointment = getAppointment(day, time);
                  const style = appointment ? STATUS_STYLES[appointment.status] || STATUS_STYLES.Confirmado : null;
                  const isPastSlot = slotTime(dateKey, time) <= now;
                  const canDrag = Boolean(appointment) && appointment.status === "Confirmado" && !saving;
                  const isValidTarget = Boolean(draggingId) && !appointment && !isPastSlot;

                  let cellClass = isPastSlot ? "bg-gray-50 hover:bg-gray-100" : "bg-gray-100 hover:bg-pink-50";
                  if (style) cellClass = style.cell;
                  if (isValidTarget) cellClass = "bg-green-50";
                  if (isValidTarget && dropTarget === slotKey) cellClass = "bg-pink-100 ring-2 ring-inset ring-pink-400";
                  if (appointment && appointment.id === draggingId) cellClass += " opacity-50";

                  return (
                    <td
                      key={di}
                      draggable={canDrag}
                      onDragStart={(e) => {
                        if (!canDrag) return;
                        e.dataTransfer.setData("text/plain", appointment.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(appointment.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                      onDragOver={(e) => {
                        if (isValidTarget) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dropTarget !== slotKey) setDropTarget(slotKey);
                        } else if (dropTarget !== null) {
                          setDropTarget(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (isValidTarget) handleDropOnSlot(day, time);
                      }}
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
                <div className="mt-3 flex flex-wrap items-center gap-2 empty:hidden">
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
                <div className="min-w-0 flex-1">
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
                    <div className="mt-2 flex flex-wrap items-center gap-2 empty:hidden">{renderWhatsApp(a)}</div>
                  )}
                </div>
                {(a.status === "Confirmado" || a.status === "Cancelado") && (
                  <button
                    className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition"
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

      {/* Modal: configuración */}
      <Modal
        isOpen={settingsOpen}
        onClose={closeSettings}
        title="Configuración"
        actions={
          settingsTab === "message"
            ? [
                { label: "Cerrar", onClick: closeSettings, className: "bg-gray-300 text-gray-700 hover:bg-gray-400" },
                {
                  label: "Restaurar original",
                  onClick: () => setTemplateDraft(DEFAULT_TEMPLATE),
                  className: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
                },
                { label: "Guardar mensaje", onClick: saveTemplate },
              ]
            : [{ label: "Cerrar", onClick: closeSettings, className: "bg-gray-300 text-gray-700 hover:bg-gray-400" }]
        }
      >
        <div role="tablist" className="flex bg-pink-50 rounded-lg p-1 gap-1 mb-4">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={settingsTab === tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={`flex-1 px-2 py-1.5 rounded-md text-sm transition-colors ${
                settingsTab === tab.id ? "bg-white shadow text-pink-700 font-semibold" : "text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {settingsTab === "message" && (
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="mensaje" className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje de recordatorio
              </label>
              <textarea
                id="mensaje"
                ref={templateRef}
                rows={8}
                value={templateDraft}
                onChange={(e) => setTemplateDraft(e.target.value)}
                className="border p-3 rounded w-full text-sm"
              />
              <p className="text-xs text-gray-500 mt-1 mb-2">
                Tocá un dato para insertarlo donde está el cursor. Se reemplaza por el del turno al enviar. Si una línea
                solo tiene datos que no están cargados (por ejemplo la dirección), esa línea no se envía.
              </p>
              <div className="flex flex-wrap gap-2">
                {PLACEHOLDERS.map((ph) => (
                  <button
                    key={ph.key}
                    type="button"
                    onClick={() => insertPlaceholder(ph.key)}
                    className="px-2 py-1 rounded-full bg-pink-100 text-pink-800 text-xs hover:bg-pink-200 transition"
                  >
                    {ph.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">Vista previa</p>
              <div className="whitespace-pre-wrap break-words bg-green-50 border border-green-200 rounded p-3 text-sm">
                {buildMessage(templateDraft, sampleAppointment, consultorios)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Con los datos de un turno real próximo, o de ejemplo si no hay.</p>
            </div>
          </div>
        )}

        {settingsTab === "places" && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Se cargan en la pestaña Consultorios: dirección, localidad, provincia y, si querés, un link de Google Maps.
              El nombre del lugar es el nombre del consultorio.
            </p>
            {(!consultorios || consultorios.length === 0) && (
              <p className="text-sm text-gray-500">No hay consultorios cargados.</p>
            )}
            {(consultorios || []).map((c) => {
              const address = buildAddress(c);
              const mapsUrl = buildMapsUrl(c);
              return (
                <div key={c.id} className="border rounded p-3 mb-2 bg-gray-50 text-sm">
                  <p className="font-semibold text-pink-800">{c.name}</p>
                  <p className={address ? "text-gray-700" : "text-gray-500"}>{address || "Sin dirección cargada"}</p>
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-pink-700 underline">
                      Probar ubicación en Maps
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Modal: confirmar el movimiento de un turno arrastrado */}
      <Modal
        isOpen={moveConfirm !== null}
        onClose={() => setMoveConfirm(null)}
        title="Mover turno"
        actions={[
          { label: "Cancelar", onClick: () => setMoveConfirm(null), className: "bg-gray-300 text-gray-700 hover:bg-gray-400" },
          { label: "Mover", onClick: confirmMove },
        ]}
      >
        {moveConfirm && (
          <div className="space-y-1">
            <p>
              <strong>Paciente:</strong> {moveConfirm.appointment.patientName}
            </p>
            <p>
              <strong>De:</strong> {moveConfirm.from}
            </p>
            <p>
              <strong>A:</strong> {moveConfirm.to}
            </p>
          </div>
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
