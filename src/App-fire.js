import React, { useState, useEffect } from "react";
import { db } from "./firebase"; // Archivo firebase.js con la config
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "firebase/firestore";

function App() {
  const [turnos, setTurnos] = useState([]);
  const [nuevoTurno, setNuevoTurno] = useState({
    paciente: "",
    tratamiento: "",
    consultorio: "",
    fecha: "",
    hora: ""
  });

  // 🔹 Cargar datos en tiempo real desde Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "turnos"), (snapshot) => {
      const datos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTurnos(datos);
    });
    return () => unsub();
  }, []);

  // 🔹 Agregar turno
  const agregarTurno = async () => {
    if (
      nuevoTurno.paciente &&
      nuevoTurno.tratamiento &&
      nuevoTurno.consultorio &&
      nuevoTurno.fecha &&
      nuevoTurno.hora
    ) {
      await addDoc(collection(db, "turnos"), nuevoTurno);
      setNuevoTurno({
        paciente: "",
        tratamiento: "",
        consultorio: "",
        fecha: "",
        hora: ""
      });
    } else {
      alert("Completa todos los campos");
    }
  };

  // 🔹 Eliminar turno
  const eliminarTurno = async (id) => {
    await deleteDoc(doc(db, "turnos", id));
  };

  // 🔹 Editar turno
  const editarTurno = async (id, datosEditados) => {
    await updateDoc(doc(db, "turnos", id), datosEditados);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Agenda LH</h1>

      <div>
        <input
          type="text"
          placeholder="Paciente"
          value={nuevoTurno.paciente}
          onChange={(e) =>
            setNuevoTurno({ ...nuevoTurno, paciente: e.target.value })
          }
        />
        <input
          type="text"
          placeholder="Tratamiento"
          value={nuevoTurno.tratamiento}
          onChange={(e) =>
            setNuevoTurno({ ...nuevoTurno, tratamiento: e.target.value })
          }
        />
        <input
          type="text"
          placeholder="Consultorio"
          value={nuevoTurno.consultorio}
          onChange={(e) =>
            setNuevoTurno({ ...nuevoTurno, consultorio: e.target.value })
          }
        />
        <input
          type="date"
          value={nuevoTurno.fecha}
          onChange={(e) =>
            setNuevoTurno({ ...nuevoTurno, fecha: e.target.value })
          }
        />
        <input
          type="time"
          value={nuevoTurno.hora}
          onChange={(e) =>
            setNuevoTurno({ ...nuevoTurno, hora: e.target.value })
          }
        />
        <button onClick={agregarTurno}>Agregar Turno</button>
      </div>

      <h2>Lista de Turnos</h2>
      <ul>
        {turnos.map((turno) => (
          <li key={turno.id}>
            {turno.fecha} {turno.hora} - {turno.paciente} ({turno.tratamiento}){" "}
            en {turno.consultorio}
            <button onClick={() => eliminarTurno(turno.id)}>❌</button>
            <button
              onClick={() =>
                editarTurno(turno.id, { paciente: "Paciente Editado" })
              }
            >
              ✏️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
