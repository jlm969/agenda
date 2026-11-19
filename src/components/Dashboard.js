import { useMemo, useState } from "react";

// Un tratamiento se cuenta como "realizado" cuando el turno está marcado como Finalizado
const DONE = "Finalizado";
const CANCELED = "Cancelado";
const CONFIRMED = "Confirmado";
const NO_TREATMENT = "__sin_tratamiento__";

const PERIODS = [
  { id: "all", label: "Todo el historial" },
  { id: "thisMonth", label: "Este mes" },
  { id: "lastMonth", label: "Mes pasado" },
  { id: "last3", label: "Últimos 3 meses" },
  { id: "thisYear", label: "Este año" },
  { id: "custom", label: "Personalizado" },
];

// === HELPERS ===
// Minúsculas, sin acentos ni espacios de más: "Botox ", "botox" y "BOTOX" son lo mismo
const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

const toDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatDate = (key) => (key ? new Date(key + "T00:00:00").toLocaleDateString("es-AR") : "");

const slotTime = (dateKey, time) => new Date(`${dateKey}T${time || "00:00"}:00`).getTime();

// "nov" y "26" para el gráfico de meses
const monthParts = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  return { name, year: String(y).slice(2) };
};

// Rango de fechas (desde, hasta) de cada período; vacío = sin límite
const getRange = (period, custom) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = (yy, mm) => toDateKey(new Date(yy, mm, 1));
  const monthEnd = (yy, mm) => toDateKey(new Date(yy, mm + 1, 0));
  switch (period) {
    case "thisMonth":
      return [monthStart(y, m), monthEnd(y, m)];
    case "lastMonth":
      return [monthStart(y, m - 1), monthEnd(y, m - 1)];
    case "last3":
      return [monthStart(y, m - 2), monthEnd(y, m)];
    case "thisYear":
      return [`${y}-01-01`, `${y}-12-31`];
    case "custom":
      return [custom.from || "", custom.to || ""];
    default:
      return ["", ""];
  }
};

const countBy = (list, keyFn) => {
  const map = new Map();
  list.forEach((item) => {
    const key = keyFn(item);
    if (key) map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const treatmentKey = (t) => normalize(t.treatment) || NO_TREATMENT;

// === PIEZAS DE PANTALLA ===
function BarRow({ label, value, max, suffix, onClick }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const labelClass = "w-28 sm:w-44 shrink-0 truncate text-left";
  return (
    <li className="flex items-center gap-2 text-sm">
      {onClick ? (
        <button onClick={onClick} className={`${labelClass} text-pink-700 hover:underline`} title={label}>
          {label}
        </button>
      ) : (
        <span className={`${labelClass} text-gray-700`} title={label}>
          {label}
        </span>
      )}
      <div className="flex-1 h-2.5 bg-pink-100 rounded-full overflow-hidden">
        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${width}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right font-semibold text-gray-800">
        {value}
        {suffix && <span className="block font-normal text-[10px] leading-3 text-gray-500">{suffix}</span>}
      </span>
    </li>
  );
}

// Gráfico de barras verticales: entra completo en el ancho de un celular
function MonthsChart({ months }) {
  const max = Math.max(0, ...months.map(([, c]) => c));
  return (
    <div className="flex items-end gap-1 h-36">
      {months.map(([key, count]) => {
        const { name, year } = monthParts(key);
        const height = count > 0 ? Math.max(6, Math.round((count / max) * 88)) : 2;
        return (
          <div key={key} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end" title={`${name} ${year}: ${count}`}>
            <span className="text-[11px] font-semibold text-gray-700 leading-4">{count > 0 ? count : ""}</span>
            <div className={`w-full rounded-t ${count > 0 ? "bg-pink-500" : "bg-gray-200"}`} style={{ height: `${height}px` }} />
            <span className="text-[10px] text-gray-600 leading-3 mt-1">{name}</span>
            <span className="text-[9px] text-gray-400 leading-3">{year}</span>
          </div>
        );
      })}
    </div>
  );
}

// === COMPONENTE PRINCIPAL ===
const Dashboard = ({ turnos = [] }) => {
  const [patientQuery, setPatientQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [treatmentFilter, setTreatmentFilter] = useState(""); // nombre normalizado
  const [view, setView] = useState("treatments");

  const patientNames = useMemo(
    () =>
      [...new Set(turnos.map((t) => String(t.patientName || "").replace(/\s+/g, " ").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [turnos]
  );

  // Tratamientos agrupados por nombre normalizado; se muestra la forma más usada
  const treatmentLabels = useMemo(() => {
    const variants = new Map();
    turnos.forEach((t) => {
      const key = normalize(t.treatment);
      if (!key) return;
      const label = String(t.treatment).replace(/\s+/g, " ").trim();
      const forms = variants.get(key) || new Map();
      forms.set(label, (forms.get(label) || 0) + 1);
      variants.set(key, forms);
    });
    const labels = new Map();
    variants.forEach((forms, key) => {
      labels.set(key, [...forms.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    });
    return labels;
  }, [turnos]);

  const treatmentOptions = useMemo(
    () => [...treatmentLabels.entries()].sort((a, b) => a[1].localeCompare(b[1], "es")),
    [treatmentLabels]
  );

  // Turnos que cumplen los filtros elegidos
  const filtered = useMemo(() => {
    const q = normalize(patientQuery);
    const exact = q !== "" && patientNames.some((n) => normalize(n) === q); // nombre completo elegido
    const [from, to] = getRange(period, custom);

    return turnos.filter((t) => {
      if (q) {
        const n = normalize(t.patientName);
        if (exact ? n !== q : !n.includes(q)) return false;
      }
      if (treatmentFilter && treatmentKey(t) !== treatmentFilter) return false;
      if (from || to) {
        if (!t.date) return false;
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
      }
      return true;
    });
  }, [turnos, patientNames, patientQuery, period, custom, treatmentFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    const done = filtered.filter((t) => t.status === DONE);
    const canceled = filtered.filter((t) => t.status === CANCELED);
    const unfinished = filtered.filter((t) => t.status === CONFIRMED && t.date && slotTime(t.date, t.time) <= now);

    const byTreatment = [...countBy(done, treatmentKey).entries()]
      .map(([key, count]) => ({ key, count, label: key === NO_TREATMENT ? "Sin tratamiento" : treatmentLabels.get(key) || key }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));

    // Por mes: desde el primero hasta el último con actividad (máximo los últimos 12)
    const monthCounts = countBy(done, (t) => (t.date ? t.date.slice(0, 7) : ""));
    let months = [];
    if (monthCounts.size > 0) {
      const keys = [...monthCounts.keys()].sort();
      let [y, m] = keys[0].split("-").map(Number);
      const [ly, lm] = keys[keys.length - 1].split("-").map(Number);
      while (y < ly || (y === ly && m <= lm)) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        months.push([key, monthCounts.get(key) || 0]);
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
    }
    const monthsTruncated = months.length > 12;
    months = months.slice(-12);

    // Pacientes: cantidad de tratamientos y última visita
    const patients = new Map();
    done.forEach((t) => {
      const name = String(t.patientName || "").replace(/\s+/g, " ").trim() || "Sin nombre";
      const entry = patients.get(name) || { count: 0, last: "" };
      entry.count += 1;
      if (t.date && t.date > entry.last) entry.last = t.date;
      patients.set(name, entry);
    });
    const ranking = [...patients.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

    const history = [...done].sort(
      (a, b) => (b.date || "").localeCompare(a.date || "") || (b.time || "").localeCompare(a.time || "")
    );

    return { done, canceled, unfinished, byTreatment, months, monthsTruncated, ranking, history };
  }, [filtered, treatmentLabels]);

  const hasFilters = patientQuery !== "" || period !== "all" || treatmentFilter !== "";
  const clearFilters = () => {
    setPatientQuery("");
    setPeriod("all");
    setCustom({ from: "", to: "" });
    setTreatmentFilter("");
  };

  const changePatient = (value) => {
    // Al empezar a buscar un paciente, se muestra su historial
    if (!patientQuery.trim() && value.trim()) setView("history");
    setPatientQuery(value);
  };
  const pickPatient = (name) => {
    setPatientQuery(name);
    setView("history");
  };

  const doneTotal = stats.done.length;
  const showRanking = stats.ranking.length > 1;
  const showHistory = patientQuery.trim() !== "";

  const views = [
    { id: "treatments", label: "Tratamientos" },
    { id: "months", label: "Meses" },
    ...(showRanking ? [{ id: "patients", label: "Pacientes" }] : []),
    ...(showHistory ? [{ id: "history", label: "Historial" }] : []),
  ];
  const activeView = views.some((v) => v.id === view) ? view : "treatments";
  const maxTreatment = Math.max(0, ...stats.byTreatment.map((t) => t.count));
  const maxPatient = Math.max(0, ...stats.ranking.map((p) => p.count));
  const unfinishedCount = stats.unfinished.length;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold text-pink-600">Estadísticas</h2>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col gap-2">
        <div className="relative">
          <input
            id="f-paciente"
            type="text"
            list="dashboard-pacientes"
            aria-label="Paciente"
            placeholder="Paciente: todos (escribí para buscar)"
            value={patientQuery}
            onChange={(e) => changePatient(e.target.value)}
            className="border p-2 pr-8 rounded w-full text-sm"
            autoComplete="off"
          />
          {patientQuery && (
            <button
              type="button"
              aria-label="Quitar filtro de paciente"
              onClick={() => setPatientQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              &times;
            </button>
          )}
          <datalist id="dashboard-pacientes">
            {patientNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="f-periodo" className="block text-[11px] text-gray-500 mb-0.5">
              Período
            </label>
            <select
              id="f-periodo"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border p-2 rounded w-full text-sm bg-white"
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-tratamiento" className="block text-[11px] text-gray-500 mb-0.5">
              Tratamiento
            </label>
            <select
              id="f-tratamiento"
              value={treatmentFilter}
              onChange={(e) => setTreatmentFilter(e.target.value)}
              className="border p-2 rounded w-full text-sm bg-white"
            >
              <option value="">Todos</option>
              {treatmentOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              id="f-desde"
              type="date"
              aria-label="Desde"
              value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              className="border p-2 rounded w-full text-sm"
            />
            <input
              id="f-hasta"
              type="date"
              aria-label="Hasta"
              value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              className="border p-2 rounded w-full text-sm"
            />
          </div>
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="self-start text-xs text-pink-700 underline hover:text-pink-900">
            Limpiar filtros
          </button>
        )}
      </div>

      {turnos.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay turnos cargados.</p>
      ) : (
        <>
          {/* Resumen */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">Tratamientos realizados</p>
                <p data-stat="done" className="text-4xl font-bold text-pink-700 leading-none mt-1">
                  {doneTotal}
                </p>
              </div>
              <div className="text-right text-xs text-gray-600 leading-5">
                <p>
                  <b data-stat="patients">{stats.ranking.length}</b> {stats.ranking.length === 1 ? "paciente" : "pacientes"}
                </p>
                <p>
                  <b data-stat="canceled">{stats.canceled.length}</b>{" "}
                  {stats.canceled.length === 1 ? "cancelado" : "cancelados"}
                </p>
              </div>
            </div>
            {unfinishedCount > 0 && (
              <p data-stat="unfinished" data-count={unfinishedCount} className="mt-3 text-xs bg-yellow-50 text-yellow-800 rounded px-2 py-1">
                {unfinishedCount === 1
                  ? "1 turno ya pasó y sigue confirmado: no se cuenta como realizado."
                  : `${unfinishedCount} turnos ya pasaron y siguen confirmados: no se cuentan como realizados.`}
              </p>
            )}
          </div>

          {doneTotal === 0 ? (
            <p className="text-sm text-gray-500">No hay tratamientos realizados con estos filtros.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-3">
              {/* Selector de vista: se muestra una sola lista a la vez */}
              <div role="tablist" className="flex bg-pink-50 rounded-lg p-1 gap-1 mb-3">
                {views.map((v) => (
                  <button
                    key={v.id}
                    role="tab"
                    aria-selected={activeView === v.id}
                    onClick={() => setView(v.id)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      activeView === v.id ? "bg-white shadow text-pink-700 font-semibold" : "text-gray-600"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {activeView === "treatments" && (
                <ul className="flex flex-col gap-2">
                  {stats.byTreatment.map((t) => (
                    <BarRow
                      key={t.key}
                      label={t.label}
                      value={t.count}
                      max={maxTreatment}
                      suffix={`${Math.round((t.count / doneTotal) * 100)}%`}
                    />
                  ))}
                </ul>
              )}

              {activeView === "months" && (
                <>
                  <MonthsChart months={stats.months} />
                  {stats.monthsTruncated && (
                    <p className="text-[11px] text-gray-400 mt-2">Últimos 12 meses con actividad.</p>
                  )}
                </>
              )}

              {activeView === "patients" && (
                <>
                  <ul className="flex flex-col gap-2">
                    {stats.ranking.slice(0, 10).map((p) => (
                      <BarRow
                        key={p.name}
                        label={p.name}
                        value={p.count}
                        max={maxPatient}
                        suffix={formatDate(p.last)}
                        onClick={() => pickPatient(p.name)}
                      />
                    ))}
                  </ul>
                  <p className="text-[11px] text-gray-400 mt-2">Top 10. Tocá un nombre para ver su historial.</p>
                </>
              )}

              {activeView === "history" && (
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {stats.history.map((t) => (
                    <li key={t.id} className="py-2 flex justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{treatmentLabels.get(treatmentKey(t)) || t.treatment}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {showRanking ? `${t.patientName} · ` : ""}
                          {t.consultorio}
                        </p>
                      </div>
                      <span className="shrink-0 text-gray-600">{formatDate(t.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
