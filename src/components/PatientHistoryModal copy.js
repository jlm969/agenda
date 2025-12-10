import React from 'react';
import Modal from './Modal';

const PatientHistoryModal = ({ isOpen, onClose, patient, appointments }) => {
  if (!patient) {
    return null;
  }

  // Filtramos los turnos y los ordenamos por fecha descendente
  const patientAppointments = appointments
    .filter((appointment) => appointment.patientName === patient.name)
    .sort((a, b) => {
      // Comparar primero por fecha
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      // Si las fechas son iguales, comparar por hora
      const timeA = a.time.replace(':', '');
      const timeB = b.time.replace(':', '');
      return timeB - timeA;
    });

  return (
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
                      appointment.status === 'completed'
                        ? 'bg-green-500 text-white'
                        : appointment.status === 'cancelled'
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {appointment.status === 'completed'
                      ? 'Finalizado'
                      : appointment.status === 'cancelled'
                      ? 'Cancelado'
                      : 'Confirmado'}
                  </div>
                     <button
                    onClick={() => alert(`Notas del turno:\n\n${appointment.notes || 'No hay notas disponibles.'}`)}
                    className="bg-green-500 text-white px-2 py-2 rounded text-sm hover:bg-blue-600 transition-colors flex items-center space-x-1"
                      >
                    <span>Notas</span>
                     
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
                    {appointment.photos && appointment.photos.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-700">Fotos del Tratamiento:</h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {appointment.photos.map((photo, photoIndex) => (
                            <img
                              key={photoIndex}
                              src={photo}
                              alt={`Tratamiento de ${patient.name} - ${photoIndex}`}
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
                    **Motivo:** {appointment.cancelReason}
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
  );
};

export default PatientHistoryModal;