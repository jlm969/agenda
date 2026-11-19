import { useState, useEffect } from "react";
import logo from "./assets/lh_estetica.png";
import Pacientes from "./components/Pacientes";
import Agenda from "./components/Agenda";
import Tratamientos from "./components/Tratamientos";
import Consultorios from "./components/Consultorios";
import Login from "./components/Login";
import Logout from "./components/Logout";
import ModalLogin from "./components/ModalLogin";
import { db, auth } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const TABS = [
  { id: "appointments", label: "Agenda" },
  { id: "patients", label: "Pacientes" },
  { id: "treatments", label: "Tratamientos" },
  { id: "consultorios", label: "Consultorios" },
];

// Orden alfabético por nombre (para listas y desplegables)
const byName = (a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });

// Escucha una colección de Firestore en tiempo real.
// Solo se suscribe cuando hay un usuario autenticado.
function useCollection(name, enabled, sorter) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      return undefined;
    }
    const unsubscribe = onSnapshot(
      collection(db, name),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setData(sorter ? list.sort(sorter) : list);
        setError(null);
      },
      (err) => {
        console.error(`Error al cargar "${name}":`, err);
        setError(err);
      }
    );
    return () => unsubscribe();
  }, [name, enabled, sorter]);

  return [data, error];
}

// Avisa cuando se publicó una versión nueva de la app.
// Compara el archivo principal que está corriendo con el que figura en el index.html más reciente del servidor.
function useUpdateAvailable() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const running = document.querySelector('script[src*="/static/js/main."]');
    if (!running) return undefined; // modo desarrollo (npm start): no aplica
    const runningSrc = running.getAttribute("src") || "";
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${process.env.PUBLIC_URL}/index.html?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const html = await res.text();
        const latest = html.match(/\/static\/js\/main\.[\w]+\.js/);
        if (latest && !cancelled && !runningSrc.includes(latest[0])) setUpdateAvailable(true);
      } catch (error) {
        // Sin conexión: se vuelve a intentar más tarde
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return updateAvailable;
}

function UpdateBanner() {
  // Se abre la misma página con una dirección distinta para obligar al navegador a bajar la versión nueva
  const reload = () => {
    window.location.href = `${window.location.pathname}?v=${Date.now()}`;
  };
  return (
    <div
      role="status"
      className="fixed bottom-0 inset-x-0 z-40 bg-pink-700 text-white px-4 pt-3 flex items-center justify-between gap-3 shadow-lg"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <span className="text-sm">Hay una nueva versión de la agenda.</span>
      <button
        onClick={reload}
        className="bg-white text-pink-700 font-semibold px-4 py-2 rounded-md text-sm whitespace-nowrap"
      >
        Actualizar
      </button>
    </div>
  );
}

function AppContent() {
  // === AUTENTICACIÓN ===
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // === DATOS DE FIREBASE ===
  const enabled = Boolean(user);
  const [patients, patientsError] = useCollection("pacientes", enabled, byName);
  const [treatments, treatmentsError] = useCollection("tratamientos", enabled, byName);
  const [consultorios, consultoriosError] = useCollection("consultorios", enabled, byName);
  const [turnos, turnosError] = useCollection("turnos", enabled);
  const loadError = patientsError || treatmentsError || consultoriosError || turnosError;

  // === NAVEGACIÓN ===
  const [activeTab, setActiveTab] = useState("appointments");

  const getTabButtonClass = (tabName) =>
    `px-4 py-2 font-semibold transition-all duration-300 rounded-md text-sm whitespace-nowrap ${
      activeTab === tabName ? "bg-pink-600 text-white" : "text-gray-600 hover:bg-gray-200"
    }`;

  // Pantalla de carga mientras se verifica la sesión
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 text-pink-700 text-xl">
        Cargando...
      </div>
    );
  }

  // Sin sesión: muestra el login
  if (!user) {
    return (
      <ModalLogin isOpen={!user} title="Iniciar sesión">
        <Login />
      </ModalLogin>
    );
  }

  return (
    <div className="bg-gradient-to-br from-pink-50 to-pink-100 min-h-screen font-sans">
      {/* BARRA DE NAVEGACIÓN */}
      <nav className="sticky top-0 z-40 p-4 bg-white shadow-md">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2 min-w-0">
            <img src={logo} alt="Logo LH" className="w-10" />
            <h1 className="text-sm font-bold text-pink-800">Liset Herzog - Medicina Estética</h1>
          </div>
          <div className="flex items-center space-x-2 text-sm shrink-0">
            <span className="hidden sm:inline text-gray-600">Hola, {user.email}</span>
            <Logout />
          </div>
        </div>

        <div className="flex justify-center gap-2 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={getTabButtonClass(tab.id)}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        {loadError && (
          <div role="alert" className="mb-4 rounded-md bg-red-100 text-red-800 px-4 py-3 text-sm">
            No se pudieron cargar algunos datos. Revisá tu conexión e intentá recargar la página.
          </div>
        )}

        {activeTab === "appointments" && (
          <Agenda patients={patients} turnos={turnos} consultorios={consultorios} treatments={treatments} />
        )}
        {activeTab === "patients" && <Pacientes patients={patients} />}
        {activeTab === "treatments" && <Tratamientos treatments={treatments} />}
        {activeTab === "consultorios" && <Consultorios consultorios={consultorios} />}
      </main>
    </div>
  );
}

function App() {
  const updateAvailable = useUpdateAvailable();
  return (
    <>
      <AppContent />
      {updateAvailable && <UpdateBanner />}
    </>
  );
}

export default App;
