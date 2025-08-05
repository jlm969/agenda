import React, { useState } from 'react';
import Modal from './Modal'; // Asumiendo que tu componente Modal está en el mismo directorio

const PatientHistoryModal = ({ isOpen, onClose, patient, appointments }) => {
  if (!patient) return null; // No renderizar si no hay paciente seleccionado

  // Filtra los turnos para el paciente seleccionado y los ordena por fecha/hora descendente
  const patientAppointments = appointments.filter(
    (app) => app.patientName === patient.name
  ).sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

  // Filtra solo los tratamientos completados (turnos con estado 'completed')
  const completedTreatments = patientAppointments.filter(
    (app) => app.status === 'completed'
  );

  // Estado para controlar qué detalle de tratamiento está expandido
  const [expandedTreatmentIndex, setExpandedTreatmentIndex] = useState(null);

  const toggleTreatmentDetails = (index) => {
    setExpandedTreatmentIndex(expandedTreatmentIndex === index ? null : index);
  };

  return (
    <Modal title={`Historial de ${patient.name}`} isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-6">
        {/* Sección de Historial de Tratamientos Realizados */}
        <div>
          <h3 className="text-xl font-semibold text-pink-700 mb-3">Historial de Tratamientos Realizados</h3>
          {completedTreatments.length > 0 ? (
            <ul className="space-y-3">
              {completedTreatments.map((treatment, index) => (
                <li key={index} className="bg-pink-50 p-3 rounded-lg shadow-sm border border-pink-100">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleTreatmentDetails(index)}>
                    <span className="font-bold text-gray-800">
                      {treatment.date} - {treatment.treatment}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-5 w-5 text-pink-600 transform transition-transform duration-200 ${
                        expandedTreatmentIndex === index ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  {expandedTreatmentIndex === index && (
                    <div className="mt-3 pt-3 border-t border-pink-200 text-gray-700">
                      {treatment.notes && <p className="mb-2"><strong>Notas:</strong> {treatment.notes}</p>}
                      {treatment.photos && treatment.photos.length > 0 && (
                        <div>
                          <strong>Fotos:</strong>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {treatment.photos.map((photo, photoIndex) => (
                              <img
                                key={photoIndex}
                                src={photo}
                                alt={`Tratamiento ${index} Foto ${photoIndex}`}
                                className="w-20 h-20 object-cover rounded-md shadow-sm"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {!treatment.notes && (!treatment.photos || treatment.photos.length === 0) && (
                        <p>No hay detalles adicionales para este tratamiento.</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No hay tratamientos realizados registrados para este paciente.</p>
          )}
        </div>

        {/* Sección de Historial de Turnos */}
        <div>
          <h3 className="text-xl font-semibold text-pink-700 mb-3">Historial de Turnos</h3>
          {patientAppointments.length > 0 ? (
            <ul className="space-y-3">
              {patientAppointments.map((appointment, index) => (
                <li key={index} className="bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-200">
                  <div className="font-bold text-gray-800">
                    {appointment.date} a las {appointment.time}
                  </div>
                  <div className="text-sm text-gray-700">
                    Tratamiento: {appointment.treatment} | Consultorio: {appointment.consultorio}
                  </div>
                  <div className="text-sm mt-1">
                    <span className="font-semibold">Estado:</span>{' '}
                    {appointment.status === 'confirmed' ? 'Confirmado' :
                     appointment.status === 'cancelled' ? 'Cancelado' :
                     appointment.status === 'completed' ? 'Finalizado' :
                     'Desconocido'}
                  </div>
                  {appointment.status === 'cancelled' && appointment.cancelReason && (
                    <div className="text-sm text-red-600 mt-1">
                      <strong>Motivo de Cancelación:</strong> {appointment.cancelReason}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No hay turnos registrados para este paciente.</p>
          )}
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button
          className="bg-pink-500 text-white px-6 py-2 rounded hover:bg-pink-600 transition"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
};

export default PatientHistoryModal;