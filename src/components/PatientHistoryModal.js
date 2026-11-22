import React, { useState } from 'react';
import Modal from './Modal';

// Estilo de cada estado (los estados se guardan como "Finalizado", "Cancelado" y "Confirmado")
const STATUS_STYLES = {
  Finalizado: { bar: 'border-l-green-500', chip: 'bg-green-100 text-green-800' },
  Cancelado: { bar: 'border-l-red-500', chip: 'bg-red-100 text-red-800' },
  Confirmado: { bar: 'border-l-pink-500', chip: 'bg-pink-100 text-pink-800' },
};

// Para comparar nombres sin importar mayúsculas, acentos ni espacios de más
const normalizeName = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

const formatDate = (key) => (key ? new Date(key + 'T00:00:00').toLocaleDateString('es-AR') : '');

const PatientHistoryModal = ({ isOpen, onClose, patient, appointments = [] }) => {
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');

  if (!patient) return null;

  // Turnos del paciente, del más reciente al más antiguo
  const patientAppointments = appointments
    .filter((appointment) => normalizeName(appointment.patientName) === normalizeName(patient.name))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

  // Abrir modal con notas o con Motivo de cancelación
  const handleOpenNotes = (appointment) => {
    let text = '';

    if (appointment.notes) {
      text = appointment.notes;
    } else if (appointment.status === 'Cancelado' && appointment.cancelReason) {
      text = `Motivo de cancelación:\n${appointment.cancelReason}`;
    } else {
      text = 'No hay notas disponibles.';
    }

    setSelectedNotes(text);
    setNotesModalOpen(true);
  };

  return (
    <>
      {/* Modal principal (historial) */}
      <Modal isOpen={isOpen} onClose={onClose} title={`Historial de Turnos de ${patient.name}`}>
        <div className="max-h-[65vh] overflow-y-auto">
          {patientAppointments.length > 0 ? (
            <ul className="space-y-3">
              {patientAppointments.map((appointment, index) => {
                const style = STATUS_STYLES[appointment.status] || STATUS_STYLES.Confirmado;
                const hasNotes = Boolean(appointment.notes) || (appointment.status === 'Cancelado' && Boolean(appointment.cancelReason));
                return (
                  <li
                    key={appointment.id || index}
                    className={`p-3 rounded-xl border border-gray-200 border-l-4 bg-white ${style.bar}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">
                          {formatDate(appointment.date)} · {appointment.time}
                        </p>
                        <p className="text-sm text-gray-600">
                          {appointment.treatment}
                          {appointment.consultorio ? ` · ${appointment.consultorio}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.chip}`}>
                        {appointment.status || 'Confirmado'}
                      </span>
                    </div>

                    {hasNotes && (
                      <button
                        onClick={() => handleOpenNotes(appointment)}
                        className="mt-2 text-sm text-pink-700 underline hover:text-pink-900"
                      >
                        {appointment.notes ? 'Ver notas' : 'Ver motivo de cancelación'}
                      </button>
                    )}

                    {appointment.status === 'Finalizado' && appointment.photos?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {appointment.photos.map((photo, photoIndex) => (
                          <img
                            key={photoIndex}
                            src={photo}
                            alt={`Tratamiento ${photoIndex}`}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500 text-center">Este paciente no tiene turnos agendados.</p>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* Modal secundario → NOTAS DEL TURNO */}
      <Modal
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        title="Notas del Turno"
      >
        <p className="text-gray-700 whitespace-pre-line">{selectedNotes}</p>

        <div className="flex justify-end mt-4">
          <button
            onClick={() => setNotesModalOpen(false)}
            className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    </>
  );
};

export default PatientHistoryModal;
