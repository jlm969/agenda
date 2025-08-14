import { useState, useEffect } from "react";
import logo from "./assets/lh_estetica.png";
import Pacientes from "./components/Pacientes";
import Agenda from "./components/Agenda";
import Tratamientos from "./components/Tratamientos";
import Consultorios from "./components/Consultorios";
import { db } from './firebase'; // Asegúrate de que esta ruta sea correcta
import { collection, onSnapshot } from "firebase/firestore";

function App() {
  // === ESTADOS CON FIREBASE ===
  const [patients, setPatients] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [consultorios, setConsultorios] = useState([]);
  const [turnos, setTurnos] = useState([]); // Ahora usamos la prop 'turnos'

  // Estado para la navegación por pestañas (Agenda como principal por defecto)
  const [activeTab, setActiveTab] = useState("appointments");

  // === EFECTOS PARA CARGAR DATOS DE FIREBASE EN TIEMPO REAL ===

  // Carga de Pacientes
  useEffect(() => {
    const patientsCollection = collection(db, "pacientes");
    const unsubscribe = onSnapshot(patientsCollection, (snapshot) => {
      const patientsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(patientsList);
    });
    return () => unsubscribe();
  }, []);

  // Carga de Tratamientos
  useEffect(() => {
    const treatmentsCollection = collection(db, "tratamientos");
    const unsubscribe = onSnapshot(treatmentsCollection, (snapshot) => {
      const treatmentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTreatments(treatmentsList);
    });
    return () => unsubscribe();
  }, []);

  // Carga de Consultorios
  useEffect(() => {
    const consultoriosCollection = collection(db, "consultorios");
    const unsubscribe = onSnapshot(consultoriosCollection, (snapshot) => {
      const consultoriosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConsultorios(consultoriosList);
    });
    return () => unsubscribe();
  }, []);

  // Carga de Turnos (La lógica de Agenda.js ya lo hace, pero es buena práctica tenerlo aquí si se usa en otros lados)
  useEffect(() => {
    const turnosCollection = collection(db, "turnos");
    const unsubscribe = onSnapshot(turnosCollection, (snapshot) => {
      const turnosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTurnos(turnosList);
    });
    return () => unsubscribe();
  }, []);
  
  // === LÓGICA DE NAVEGACIÓN Y RENDERIZADO ===
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
            turnos={turnos}
            consultorios={consultorios}
            treatments={treatments}
          />
        )}
        {activeTab === "patients" && <Pacientes patients={patients} />}
        {activeTab === "treatments" && <Tratamientos treatments={treatments} />}
        {activeTab === "consultorios" && <Consultorios consultorios={consultorios} />}
      </div>
    </div>
  );
}

export default App;