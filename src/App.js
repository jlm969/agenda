import { useState, useEffect } from "react";
import logo from "./assets/lh_estetica.png";
import Pacientes from "./components/Pacientes";
import Agenda from "./components/Agenda";
import Tratamientos from "./components/Tratamientos";
import Consultorios from "./components/Consultorios";
import Login from "./components/Login";
import Logout from "./components/Logout";
import ModalLogin from "./components/ModalLogin";
import { db, auth } from './firebase'; 
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

function App() {
 // === ESTADO DE AUTENTICACIÓN ===
 const [user, setUser] = useState(null);
 const [loading, setLoading] = useState(true);

 // === EFECTO PARA ESCUCHAR CAMBIOS DE AUTENTICACIÓN ===
 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
   setUser(currentUser);
   setLoading(false);
  });
  return () => unsubscribe();
 }, []);

 // === ESTADOS CON FIREBASE ===
 const [patients, setPatients] = useState([]);
 const [treatments, setTreatments] = useState([]);
 const [consultorios, setConsultorios] = useState([]);
 const [turnos, setTurnos] = useState([]);

 // Carga de Pacientes
 useEffect(() => {
  if (user) { // Solo carga los datos si el usuario está autenticado
   const patientsCollection = collection(db, "pacientes");
   const unsubscribe = onSnapshot(patientsCollection, (snapshot) => {
    const patientsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setPatients(patientsList);
   });
   return () => unsubscribe();
  }
 }, [user]);

 // Carga de Tratamientos
 useEffect(() => {
  if (user) {
   const treatmentsCollection = collection(db, "tratamientos");
   const unsubscribe = onSnapshot(treatmentsCollection, (snapshot) => {
    const treatmentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setTreatments(treatmentsList);
   });
   return () => unsubscribe();
  }
 }, [user]);

 // Carga de Consultorios
 useEffect(() => {
  if (user) {
   const consultoriosCollection = collection(db, "consultorios");
   const unsubscribe = onSnapshot(consultoriosCollection, (snapshot) => {
    const consultoriosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setConsultorios(consultoriosList);
   });
   return () => unsubscribe();
  }
 }, [user]);

 // Carga de Turnos
 useEffect(() => {
  if (user) {
   const turnosCollection = collection(db, "turnos");
   const unsubscribe = onSnapshot(turnosCollection, (snapshot) => {
    const turnosList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setTurnos(turnosList);
   });
   return () => unsubscribe();
  }
 }, [user]);
 
 // === LÓGICA DE NAVEGACIÓN Y RENDERIZADO ===
 const [activeTab, setActiveTab] = useState("appointments");

 const getTabButtonClass = (tabName) => {
  return `px-6 py-3 font-semibold transition-all duration-300 ${
   activeTab === tabName
    ? "bg-pink-500 text-white rounded-t-lg shadow-md"
    : "bg-white text-gray-600 rounded-t-lg hover:bg-pink-100"
  }`;
 };

 // Muestra una pantalla de carga mientras se verifica el estado de autenticación
 if (loading) {
  return (
   <div className="flex justify-center items-center min-h-screen bg-gray-100 text-pink-700 text-xl">
    Cargando...
   </div>
  );
 }

 // Si no está autenticado, muestra el Login dentro del Modal
 if (!user) {
  return (
   <ModalLogin isOpen={!user} title="Iniciar Sesión">
    <Login />
   </ModalLogin>
  );
 }

 // Si el usuario está autenticado, muestra la aplicación completa
 return (
  <div className="p-6 bg-gradient-to-br from-pink-50 to-pink-100 min-h-screen font-sans">
   <header className="flex flex-col items-center mb-10">
    <img src={logo} alt="Logo LH" className="w-48 mb-4" />
    <h1 className="text-3xl font-bold text-pink-800">Liset Herzog - Medicina Estética</h1>
    <div className="mt-4 text-gray-600 flex items-center space-x-4">
     <span className="font-medium">Hola, {user.email}!</span>
     <Logout />
    </div>
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