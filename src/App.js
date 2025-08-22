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
    if (user) {
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
      return `px-4 py-2 font-semibold transition-all duration-300 rounded-md text-sm ${
          activeTab === tabName
              ? "bg-pink-600 text-white"
              : "text-gray-600 hover:bg-gray-200"
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
      <div className="bg-gradient-to-br from-pink-50 to-pink-100 min-h-screen font-sans">
          
          {/* BARRA DE NAVEGACIÓN HORIZONTAL */}
          <nav className="sticky top-0 z-10 p-4 bg-white shadow-md">
              {/* Contenedor superior con logo, título y cerrar sesión */}
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                      <img src={logo} alt="Logo LH" className="w-10" />
                      <h1 className="text-sm font-bold text-pink-800">Liset Herzog - Medicina Estética</h1>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-600">Hola, {user.email}!</span>
                      <Logout />
                  </div>
              </div>

              {/* Contenedor inferior de los botones de navegación */}
              <div className="flex justify-center space-x-2">
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
          </nav>

          {/* CONTENIDO PRINCIPAL */}
          <main className="p-6 max-w-7xl mx-auto">
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
          </main>
      </div>
  );
}

export default App;