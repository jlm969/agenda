import React, { useState } from 'react';
import Modal from './Modal';

const PatientHistoryModal = ({ isOpen, onClose, patient, appointments }) => {
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');

  if (!patient) return null;

  // Filtramos los turnos y los ordenamos por fecha descendente
  const patientAppointments = appointments
    .filter((appointment) => appointment.patientName === patient.name)
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      const timeA = a.time.replace(':', '');
      const timeB = b.time.replace(':', '');
      return timeB - timeA;
    });

  // 👉 Abrir modal con notas
  // const handleOpenNotes = (notes) => {
  //    setSelectedNotes(notes || 'No hay notas disponibles.');
  //    setNotesModalOpen(true);       
  // };

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
      <Modal isOpen={isOpen} onClose={onClose} title={`Historial de Turnos de ${patient.name}`} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {patientAppointments.length > 0 ? (
            <ul className="space-y-4">
              {patientAppointments.map((appointment, index) => (
                <li
                  key={index}
                  className={`p-4 rounded-lg shadow-sm border ${
                    appointment.status === 'completed'
                      ? 'bg-green-100 border-green-200'
                      : appointment.status === 'cancelled'
                      ? 'bg-red-100 border-red-200'
                      : 'bg-blue-100 border-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800">
                        Fecha: {appointment.date} | Hora: {appointment.time}
                      </span>
                      <span className="text-sm text-gray-600">
                        Tratamiento: {appointment.treatment} en {appointment.consultorio}
                      </span>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        appointment.status === 'Finalizado'
                          ? 'bg-green-500 text-white'
                          : appointment.status === 'Cancelado'
                          ? 'bg-red-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      {appointment.status === 'Finalizado'
                        ? 'Finalizado'
                        : appointment.status === 'Cancelado'
                        ? 'Cancelado'
                        : 'Confirmado'}
                    </div>
                    
                    {/* BOTÓN PARA ABRIR EL MODAL DE NOTAS */}
                    <button
                      //onClick={() => handleOpenNotes(appointment.notes)}
                      onClick={() => handleOpenNotes(appointment)}
                     // className="bg-green-500 text-white px-2 py-2 rounded text-sm hover:bg-green-600 transition flex items-center"
                    
                       //className="bg-gray-500 text-white px-3 py-1 rounded-full text-sm hover:bg-gray-600 transition-colors flex items-center space-x ml-2"
                       className="bg-gray-300 text-white-700 px-3 py-1 rounded-full text-sm hover:bg-gray-400 transition-colors flex items-center space-x ml-2"
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
                      
                      Notas
                    </button>
                  </div>

                  {appointment.status === 'completed' && (
                    <div className="mt-4 border-t pt-4 border-gray-300">
                      {appointment.notes && (
                        <div className="mb-2">
                          <h4 className="font-semibold text-gray-700">Notas:</h4>
                          <p className="text-sm text-gray-600">{appointment.notes}</p>
                        </div>
                      )}

                      {appointment.photos?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-700">Fotos del Tratamiento:</h4>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {appointment.photos.map((photo, photoIndex) => (
                              <img
                                key={photoIndex}
                                src={photo}
                                alt={`Tratamiento ${photoIndex}`}
                                className="w-24 h-24 object-cover rounded-lg shadow-md"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {appointment.status === 'cancelled' && appointment.cancelReason && (
                    <div className="mt-2 text-sm text-red-700">
                      Motivo: {appointment.cancelReason}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center">Este paciente no tiene turnos agendados.</p>
          )}
        </div>

        <div className="flex justify-end mt-6">
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

        <div className="flex justify-end mt-6">
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
