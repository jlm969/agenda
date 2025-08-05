import { useState, useEffect } from "react";
import logo from "./assets/lh_estetica.png";
import Pacientes from "./components/Pacientes";
import Agenda from "./components/Agenda";
import Tratamientos from "./components/Tratamientos";
import Consultorios from "./components/Consultorios";

function App() {
  // Estados y lógica para Pacientes
  const [patients, setPatients] = useState(() => {
    const savedPatients = localStorage.getItem("lh-patients");
    return savedPatients ? JSON.parse(savedPatients) : [];
  });
  const [newPatient, setNewPatient] = useState({ name: "", phone: "", email: "", photo: "" });
  const [editingPatientIndex, setEditingPatientIndex] = useState(null);
  const [filter, setFilter] = useState("");

  // Estados y lógica para Turnos
  const [appointments, setAppointments] = useState(() => {
    const savedAppointments = localStorage.getItem("lh-appointments");
    try {
      const parsedAppointments = savedAppointments ? JSON.parse(savedAppointments) : [];
      return Array.isArray(parsedAppointments) ? parsedAppointments.map(app => ({
        ...app,
        status: app.status || 'confirmed'
      })) : [];
    } catch (e) {
      console.error("Error parsing saved appointments from localStorage", e);
      return [];
    }
  });

  // Estados y lógica para Tratamientos
  const [treatments, setTreatments] = useState(() => {
    const savedTreatments = localStorage.getItem("lh-treatments");
    return savedTreatments ? JSON.parse(savedTreatments) : [];
  });
  const [newTreatment, setNewTreatment] = useState({ name: "", description: "", price: "", duration: "" });
  const [editingTreatmentIndex, setEditingTreatmentIndex] = useState(null);

  // Estados y lógica para Consultorios
  const [consultorios, setConsultorios] = useState(() => {
    const savedConsultorios = localStorage.getItem("lh-consultorios");
    return savedConsultorios ? JSON.parse(savedConsultorios) : [
      // Estructura de datos actualizada
      { name: "MM Estetica", address: "Dirección de MM", city: "Localidad de MM", phone: "Teléfono de MM" },
      { name: "Fisio Med", address: "Dirección de Fisio", city: "Localidad de Fisio", phone: "Teléfono de Fisio" },
    ];
  });
  // Nuevo estado para un consultorio con más campos
  const [newConsultorio, setNewConsultorio] = useState({ name: "", address: "", city: "", phone: "" });
  const [editingConsultorioIndex, setEditingConsultorioIndex] = useState(null);

  // Estado para la navegación por pestañas (Agenda como principal por defecto)
  const [activeTab, setActiveTab] = useState("appointments");

  // Efectos para guardar todos los datos en el almacenamiento local
  useEffect(() => {
    localStorage.setItem("lh-patients", JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem("lh-appointments", JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem("lh-treatments", JSON.stringify(treatments));
  }, [treatments]);
  
  useEffect(() => {
    localStorage.setItem("lh-consultorios", JSON.stringify(consultorios));
  }, [consultorios]);

  // Funciones para Pacientes
  const addOrUpdatePatient = () => {
    if (newPatient.name.trim()) {
      if (editingPatientIndex !== null) {
        const updatedPatients = [...patients];
        updatedPatients[editingPatientIndex] = newPatient;
        setPatients(updatedPatients);
      } else {
        setPatients([...patients, { ...newPatient, history: [] }]);
      }
      setNewPatient({ name: "", phone: "", email: "", photo: "" });
      setEditingPatientIndex(null);
    }
  };

  const editPatient = (index) => {
    setNewPatient(patients[index]);
    setEditingPatientIndex(index);
  };

  const deletePatient = (index) => {
    const updated = patients.filter((_, i) => i !== index);
    setPatients(updated);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewPatient({ ...newPatient, photo: reader.result });
    };
    if (file) {
      reader.readAsDataURL(file);
    }
  };

  // Funciones para Turnos
  const addAppointment = (appointmentToAdd) => {
    const conflict = appointments.some(a =>
      a.date === appointmentToAdd.date && a.time === appointmentToAdd.time && a.consultorio === appointmentToAdd.consultorio
    );
    if (!conflict) {
      setAppointments([...appointments, { ...appointmentToAdd, status: 'confirmed', notes: '', photos: [] }]);
      return true;
    }
    return false;
  };
  
  const deleteAppointment = (index) => {
    const updated = appointments.filter((_, i) => i !== index);
    setAppointments(updated);
  };
  
  const updateAppointment = (index, updatedAppointment) => {
    const updated = [...appointments];
    updated[index] = updatedAppointment;
    setAppointments(updated);
  };

  // Funciones para Tratamientos
  const addOrUpdateTreatment = () => {
    if (newTreatment.name.trim()) {
      if (editingTreatmentIndex !== null) {
        const updatedTreatments = [...treatments];
        updatedTreatments[editingTreatmentIndex] = newTreatment;
        setTreatments(updatedTreatments);
      } else {
        setTreatments([...treatments, { ...newTreatment }]);
      }
      setNewTreatment({ name: "", description: "", price: "", duration: "" });
      setEditingTreatmentIndex(null);
    }
  };

  const editTreatment = (index) => {
    setNewTreatment(treatments[index]);
    setEditingTreatmentIndex(index);
  };

  const deleteTreatment = (index) => {
    const updated = treatments.filter((_, i) => i !== index);
    setTreatments(updated);
  };

  // Funciones para Consultorios
  const addOrUpdateConsultorio = () => {
    if (newConsultorio.name.trim()) {
      if (editingConsultorioIndex !== null) {
        const updatedConsultorios = [...consultorios];
        updatedConsultorios[editingConsultorioIndex] = newConsultorio;
        setConsultorios(updatedConsultorios);
      } else {
        setConsultorios([...consultorios, { ...newConsultorio }]);
      }
      // Reiniciamos el estado con todos los campos
      setNewConsultorio({ name: "", address: "", city: "", phone: "" });
      setEditingConsultorioIndex(null);
    }
  };

  const editConsultorio = (index) => {
    setNewConsultorio(consultorios[index]);
    setEditingConsultorioIndex(index);
  };

  const deleteConsultorio = (index) => {
    const updated = consultorios.filter((_, i) => i !== index);
    setConsultorios(updated);
  };

  const getTabButtonClass = (tabName) => {
    return `px-6 py-3 font-semibold transition-all duration-300 ${
      activeTab === tabName
        ? "bg-pink-500 text-white rounded-t-lg shadow-md"
        : "bg-white text-gray-600 rounded-t-lg hover:bg-pink-100"
    }`;
  };

  return (
    <div className="p-6 bg-gradient-to-br from-pink-50 to-pink-100 min-h-screen font-sans">
      <header className="flex flex-col items-center mb-10">
        <img src={logo} alt="Logo LH" className="w-48 mb-4" />
        <h1 className="text-3xl font-bold text-pink-800">Liset Herzog - Medicina Estética</h1>
      </header>

      <div className="flex justify-center mb-6">
        <button className={getTabButtonClass("appointments")} onClick={() => setActiveTab("appointments")}>
          Agenda
        </button>
        <button className={getTabButtonClass("patients")} onClick={() => setActiveTab("patients")}>
          Pacientes
        </button>
        <button className={getTabButtonClass("treatments")} onClick={() => setActiveTab("treatments")}>
          Tratamientos
        </button>
        <button className={getTabButtonClass("consultorios")} onClick={() => setActiveTab("consultorios")}>
          Consultorios
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 bg-white rounded-2xl shadow-lg">
        {activeTab === "appointments" && (
          <Agenda
            patients={patients}
            appointments={appointments}
            addAppointment={addAppointment}
            deleteAppointment={deleteAppointment}
            updateAppointment={updateAppointment}
            consultorios={consultorios}
            treatments={treatments}
          />
        )}
        {activeTab === "patients" && (
          <Pacientes
            patients={patients}
            newPatient={newPatient}
            setNewPatient={setNewPatient}
            addOrUpdatePatient={addOrUpdatePatient}
            editingPatientIndex={editingPatientIndex}
            setEditingPatientIndex={setEditingPatientIndex}
            filter={filter}
            setFilter={setFilter}
            editPatient={editPatient}
            deletePatient={deletePatient}
            handlePhotoUpload={handlePhotoUpload}
            appointments={appointments}
          />
        )}
        {activeTab === "treatments" && (
          <Tratamientos
            treatments={treatments}
            newTreatment={newTreatment}
            setNewTreatment={setNewTreatment}
            addOrUpdateTreatment={addOrUpdateTreatment}
            editingTreatmentIndex={editingTreatmentIndex}
            setEditingTreatmentIndex={setEditingTreatmentIndex}
            editTreatment={editTreatment}
            deleteTreatment={deleteTreatment}
          />
        )}
        {activeTab === "consultorios" && (
          <Consultorios
            consultorios={consultorios}
            newConsultorio={newConsultorio}
            setNewConsultorio={setNewConsultorio}
            addOrUpdateConsultorio={addOrUpdateConsultorio}
            editingConsultorioIndex={editingConsultorioIndex}
            setEditingConsultorioIndex={setEditingConsultorioIndex}
            editConsultorio={editConsultorio}
            deleteConsultorio={deleteConsultorio}
          />
        )}
      </div>
    </div>
  );
}

export default App;