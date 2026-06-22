import React, { useState, useEffect, useMemo, createContext, useContext } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";
import Papa from "papaparse";
import {
  Plus, Upload, TrendingUp, Wallet, Target, Trash2, Award, Flame, Sparkles,
  Check, X, Loader2, Search, Download, Pencil, PiggyBank, Landmark,
  AlertTriangle, RefreshCw
} from "lucide-react";

// ---------- Multi-moneda ----------
const CURRENCIES = {
  MXN: { locale: "es-MX", code: "MXN", label: "Peso MX ($)" },
  USD: { locale: "en-US", code: "USD", label: "Dólar (US$)" },
  EUR: { locale: "es-ES", code: "EUR", label: "Euro (€)" },
  COP: { locale: "es-CO", code: "COP", label: "Peso COL ($)" },
  ARS: { locale: "es-AR", code: "ARS", label: "Peso ARG ($)" },
  CLP: { locale: "es-CL", code: "CLP", label: "Peso CL ($)" },
};
const makeFmt = (cur) => (n) =>
  new Intl.NumberFormat((CURRENCIES[cur] || CURRENCIES.MXN).locale, {
    style: "currency",
    currency: (CURRENCIES[cur] || CURRENCIES.MXN).code,
    maximumFractionDigits: 0,
  }).format(n || 0);

const FmtCtx = createContext(makeFmt("MXN"));
const useFmt = () => useContext(FmtCtx);

// ---------- Persistencia (window.storage con fallback a localStorage) ----------
const store = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage?.get) {
        const r = await window.storage.get(key);
        if (r && r.value != null) return r;
      }
    } catch (e) {}
    try {
      const v = localStorage.getItem(key);
      return v != null ? { value: v } : null;
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage?.set) {
        await window.storage.set(key, value);
      }
    } catch (e) {}
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  },
};

const CATS_INCOME = ["Salario", "Comisión", "Negocio", "Otro ingreso"];
const CATS_EXPENSE = ["Renta/Hipoteca", "Comida", "Transporte", "Deuda", "Gusto", "Servicios", "Otro gasto"];

const LEVELS = [
  { min: 0, name: "Empleado", color: "#8a8f98" },
  { min: 500, name: "Autoempleado", color: "#3fa9f5" },
  { min: 2000, name: "Inversionista junior", color: "#2ecc71" },
  { min: 6000, name: "Inversionista", color: "#d4af37" },
  { min: 15000, name: "Libre financiero", color: "#e8c468" },
];

function getLevel(netWorth) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (netWorth >= l.min) lvl = l;
  return lvl;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthOf = (d) => (d || todayStr()).slice(0, 7);

export default function FinanceApp() {
  const [tab, setTab] = useState("dashboard");
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ type: "expense", category: CATS_EXPENSE[0], amount: "", note: "", date: todayStr() });
  const [editingId, setEditingId] = useState(null);
  const [proj, setProj] = useState({ months: 12, target: "", monthlyContribution: "", rate: 0 });
  const [toast, setToast] = useState(null);
  const [fixedItems, setFixedItems] = useState([]);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Nuevas funciones
  const [accounts, setAccounts] = useState([]);      // {id,name,type:'asset'|'debt',balance}
  const [budgets, setBudgets] = useState({});        // { categoria: limiteMensual }
  const [currency, setCurrency] = useState("MXN");
  const [lastApplied, setLastApplied] = useState(null); // 'YYYY-MM' último mes en que se aplicaron fijos
  const [filter, setFilter] = useState({ q: "", type: "all", category: "all", from: "", to: "" });

  const fmt = useMemo(() => makeFmt(currency), [currency]);

  // ---------- Carga inicial ----------
  useEffect(() => {
    (async () => {
      const pairs = [
        ["finanzas:entries", setEntries],
        ["finanzas:fixedItems", setFixedItems],
        ["finanzas:accounts", setAccounts],
        ["finanzas:budgets", setBudgets],
        ["finanzas:lastApplied", (v) => setLastApplied(v)],
      ];
      for (const [key, setter] of pairs) {
        try {
          const res = await store.get(key);
          if (res && res.value != null) {
            if (key === "finanzas:lastApplied") setter(JSON.parse(res.value));
            else setter(JSON.parse(res.value));
          }
        } catch (e) {}
      }
      try {
        const res = await store.get("finanzas:currency");
        if (res && res.value) setCurrency(JSON.parse(res.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // ---------- Persistencia reactiva ----------
  useEffect(() => { if (loaded) store.set("finanzas:entries", JSON.stringify(entries)); }, [entries, loaded]);
  useEffect(() => { if (loaded) store.set("finanzas:fixedItems", JSON.stringify(fixedItems)); }, [fixedItems, loaded]);
  useEffect(() => { if (loaded) store.set("finanzas:accounts", JSON.stringify(accounts)); }, [accounts, loaded]);
  useEffect(() => { if (loaded) store.set("finanzas:budgets", JSON.stringify(budgets)); }, [budgets, loaded]);
  useEffect(() => { if (loaded) store.set("finanzas:currency", JSON.stringify(currency)); }, [currency, loaded]);
  useEffect(() => { if (loaded) store.set("finanzas:lastApplied", JSON.stringify(lastApplied)); }, [lastApplied, loaded]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of entries) {
      if (e.type === "income") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense, net: income - expense };
  }, [entries]);

  const monthly = useMemo(() => {
    const map = {};
    for (const e of entries) {
      const key = e.date.slice(0, 7);
      if (!map[key]) map[key] = { month: key, income: 0, expense: 0 };
      if (e.type === "income") map[key].income += e.amount;
      else map[key].expense += e.amount;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  const avgMonthlySave = useMemo(() => {
    if (monthly.length === 0) return 0;
    const sum = monthly.reduce((acc, m) => acc + (m.income - m.expense), 0);
    return sum / monthly.length;
  }, [monthly]);

  const fixedNet = useMemo(() => {
    let income = 0, expense = 0;
    for (const f of fixedItems) {
      if (f.type === "income") income += f.amount; else expense += f.amount;
    }
    return { income, expense, net: income - expense };
  }, [fixedItems]);

  // ---------- Patrimonio (activos / deudas) ----------
  const wealth = useMemo(() => {
    let assets = 0, debts = 0;
    for (const a of accounts) {
      if (a.type === "debt") debts += a.balance;
      else assets += a.balance;
    }
    return { assets, debts, net: assets - debts };
  }, [accounts]);

  // Patrimonio neto real: activos - deudas si hay cuentas; si no, flujo acumulado.
  const netWorth = accounts.length > 0 ? wealth.net : totals.net;

  // ---------- Presupuestos ----------
  const curMonth = monthOf();
  const spentByCat = useMemo(() => {
    const m = {};
    for (const e of entries) {
      if (e.type === "expense" && e.date.slice(0, 7) === curMonth) {
        m[e.category] = (m[e.category] || 0) + e.amount;
      }
    }
    return m;
  }, [entries, curMonth]);

  const budgetAlerts = useMemo(() => {
    let warning = 0, over = 0;
    for (const cat of Object.keys(budgets)) {
      const limit = budgets[cat];
      if (!limit) continue;
      const spent = spentByCat[cat] || 0;
      if (spent >= limit) over++;
      else if (spent >= limit * 0.8) warning++;
    }
    return { warning, over };
  }, [budgets, spentByCat]);

  // ---------- Asistente IA ----------
  const askAI = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiPreview(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: "Extraes ingresos y gastos FIJOS (recurrentes mensuales) de una descripción en español. Responde SOLO con un arreglo JSON, sin texto adicional, sin markdown, sin backticks. Cada elemento: {\"type\":\"income\"|\"expense\",\"category\":string,\"amount\":number,\"note\":string}. Usa montos mensuales (si dan algo semanal o quincenal, conviértelo a mensual, dividiendo o multiplicando segun corresponda). Para 'category' usa una etiqueta corta y clara en español basada en lo que describe (ej. 'Salario', 'Renta', 'Comida', 'Deuda', 'Servicios', 'Transporte'). Si no hay info suficiente para un monto, no inventes esa entrada.",
          messages: [{ role: "user", content: aiText }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).map(b => b.text || "").join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setAiError("No encontré montos claros en tu descripción. Intenta ser más específico.");
      } else {
        setAiPreview(parsed.map(p => ({ ...p, id: crypto.randomUUID(), include: true, amount: Number(p.amount) || 0 })));
      }
    } catch (e) {
      setAiError("No pude procesar eso. Intenta de nuevo o sé más específico con los montos.");
    } finally {
      setAiLoading(false);
    }
  };

  // El asistente solo construye la PLANTILLA fija (no movimientos reales) → evita doble conteo.
  const confirmAiPreview = () => {
    const toAdd = aiPreview.filter(p => p.include && p.amount > 0);
    setFixedItems(prev => [...prev, ...toAdd.map(({ include, ...rest }) => rest)]);
    setAiPreview(null);
    setAiText("");
    showToast(`${toAdd.length} conceptos fijos guardados · aplícalos al mes desde el Tablero`);
  };

  const deleteFixedItem = (id) => setFixedItems(prev => prev.filter(f => f.id !== id));

  // ---------- Aplicar conceptos fijos del mes ----------
  const applyFixedThisMonth = () => {
    if (fixedItems.length === 0) return showToast("No tienes conceptos fijos");
    if (lastApplied === curMonth) return showToast("Ya aplicaste los fijos de este mes");
    const date = `${curMonth}-01`;
    const newEntries = fixedItems.map(f => ({
      id: crypto.randomUUID(),
      type: f.type,
      category: f.category,
      amount: f.amount,
      note: (f.note ? f.note + " " : "") + "(fijo)",
      date,
    }));
    setEntries(prev => [...newEntries, ...prev]);
    setLastApplied(curMonth);
    showToast(`${newEntries.length} conceptos fijos aplicados a ${curMonth}`);
  };

  const level = getLevel(netWorth);
  const nextLevel = LEVELS[LEVELS.findIndex(l => l.name === level.name) + 1];
  const progressToNext = nextLevel ? Math.min(100, Math.max(0, ((netWorth - level.min) / (nextLevel.min - level.min)) * 100)) : 100;

  // ---------- Movimientos (crear / editar) ----------
  const saveEntry = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return showToast("Pon un monto válido");
    if (editingId) {
      setEntries(prev => prev.map(e => e.id === editingId ? { ...e, ...form, amount } : e));
      setEditingId(null);
      showToast("Movimiento actualizado");
    } else {
      const entry = { id: crypto.randomUUID(), ...form, amount };
      setEntries(prev => [entry, ...prev]);
      showToast(form.type === "income" ? "+XP: ingreso registrado" : "Gasto registrado");
    }
    setForm(f => ({ ...f, amount: "", note: "" }));
  };

  const startEdit = (e) => {
    setForm({ type: e.type, category: e.category, amount: String(e.amount), note: e.note || "", date: e.date });
    setEditingId(e.id);
    setTab("movimientos");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(f => ({ ...f, amount: "", note: "" }));
  };

  const deleteEntry = (id) => {
    if (editingId === id) cancelEdit();
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  // ---------- Cuentas ----------
  const addAccount = (acc) => setAccounts(prev => [...prev, { id: crypto.randomUUID(), ...acc }]);
  const deleteAccount = (id) => setAccounts(prev => prev.filter(a => a.id !== id));

  // ---------- Presupuestos ----------
  const setBudget = (cat, amount) => {
    setBudgets(prev => {
      const next = { ...prev };
      if (!amount || amount <= 0) delete next[cat];
      else next[cat] = amount;
      return next;
    });
  };

  // ---------- Exportar / Importar CSV ----------
  const exportCSV = () => {
    if (entries.length === 0) return showToast("No hay movimientos para exportar");
    const header = ["date", "type", "category", "amount", "note"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = entries.map(e => [e.date, e.type, e.category, e.amount, e.note || ""].map(esc).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${entries.length} movimientos exportados`);
  };

  const handleCSV = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data;
        const parsed = [];
        for (const r of rows) {
          const amountRaw = r.amount ?? r.monto ?? r.Amount ?? r.Monto;
          const amount = parseFloat(String(amountRaw).replace(/[^0-9.-]/g, ""));
          if (!amount) continue;
          // Tipo: 1) columna explícita, 2) signo del monto.
          const typeRaw = (r.type || r.tipo || "").toString().toLowerCase();
          let type;
          if (typeRaw.includes("ingreso") || typeRaw.includes("income")) type = "income";
          else if (typeRaw.includes("gasto") || typeRaw.includes("expense")) type = "expense";
          else type = amount < 0 ? "expense" : "income";
          parsed.push({
            id: crypto.randomUUID(),
            type,
            category: r.category || r.categoria || (type === "income" ? "Otro ingreso" : "Otro gasto"),
            amount: Math.abs(amount),
            note: r.note || r.nota || r.description || r.descripcion || "",
            date: (r.date || r.fecha || todayStr()).slice(0, 10),
          });
        }
        if (parsed.length === 0) {
          showToast("No reconocí columnas (usa: date, type, category, amount, note)");
          return;
        }
        setEntries(prev => [...parsed, ...prev]);
        showToast(`${parsed.length} movimientos importados`);
      },
      error: () => showToast("No pude leer el archivo"),
    });
  };

  // ---------- Proyección ----------
  const months = Math.max(1, parseInt(proj.months) || 1);
  const baseContribution = proj.monthlyContribution !== "" ? parseFloat(proj.monthlyContribution) : (fixedItems.length > 0 ? fixedNet.net : avgMonthlySave);
  const monthlyRate = (parseFloat(proj.rate) || 0) / 100 / 12;
  const target = parseFloat(proj.target) || 0;

  const projectionData = useMemo(() => {
    let balance = netWorth;
    const data = [{ month: 0, balance: Math.round(balance) }];
    for (let i = 1; i <= months; i++) {
      balance = balance * (1 + monthlyRate) + baseContribution;
      data.push({ month: i, balance: Math.round(balance) });
    }
    return data;
  }, [netWorth, months, baseContribution, monthlyRate]);

  const monthsToTarget = useMemo(() => {
    if (!target || baseContribution <= 0) return null;
    let balance = netWorth;
    let m = 0;
    while (balance < target && m < 1200) {
      balance = balance * (1 + monthlyRate) + baseContribution;
      m++;
    }
    return balance >= target ? m : null;
  }, [target, baseContribution, netWorth, monthlyRate]);

  const finalBalance = projectionData[projectionData.length - 1]?.balance ?? 0;

  const needsApply = fixedItems.length > 0 && lastApplied !== curMonth;

  return (
    <FmtCtx.Provider value={fmt}>
    <div style={{ minHeight: "100vh", background: "#0c1118", color: "#e9ecf1", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        * { box-sizing: border-box; }
        input, select { background:#161d29; border:1px solid #29323f; color:#e9ecf1; border-radius:8px; padding:9px 11px; font-size:14px; outline:none; }
        input:focus, select:focus { border-color:#d4af37; }
        button { cursor:pointer; }
        ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-thumb{background:#29323f;border-radius:4px}
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea { background:#161d29; border:1px solid #29323f; color:#e9ecf1; border-radius:8px; padding:10px 12px; font-size:13px; outline:none; }
        textarea:focus { border-color:#d4af37; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="sg" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Tu Ruta Financiera</div>
            <div style={{ fontSize: 13, color: "#8a93a3", marginTop: 2 }}>Como Rat Race, pero con tu dinero de verdad</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ fontSize: 12, padding: "7px 9px" }} title="Moneda">
              {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: "8px 14px" }}>
              <Award size={18} color={level.color} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: level.color }}>{level.name}</div>
                <div style={{ width: 110, height: 5, background: "#0c1118", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ width: `${progressToNext}%`, height: "100%", background: level.color, transition: "width .4s" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 18, borderBottom: "1px solid #20283480", flexWrap: "wrap" }}>
          {[
            { id: "dashboard", label: "Tablero", icon: Wallet },
            { id: "asistente", label: "Asistente IA", icon: Sparkles },
            { id: "movimientos", label: "Movimientos", icon: Plus },
            { id: "presupuestos", label: "Presupuestos", icon: PiggyBank },
            { id: "patrimonio", label: "Patrimonio", icon: Landmark },
            { id: "proyeccion", label: "Proyección", icon: TrendingUp },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: "none", border: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6,
                color: tab === t.id ? "#d4af37" : "#8a93a3", borderBottom: tab === t.id ? "2px solid #d4af37" : "2px solid transparent",
                fontSize: 13, fontWeight: 600, marginBottom: -1
              }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px" }}>
        {tab === "dashboard" && (
          <Dashboard totals={totals} monthly={monthly} entries={entries} avgMonthlySave={avgMonthlySave}
            fixedItems={fixedItems} fixedNet={fixedNet} wealth={wealth} netWorth={netWorth} hasAccounts={accounts.length > 0}
            budgetAlerts={budgetAlerts} needsApply={needsApply} applyFixedThisMonth={applyFixedThisMonth}
            curMonth={curMonth} goTo={setTab} startEdit={startEdit} />
        )}

        {tab === "asistente" && (
          <Asistente aiText={aiText} setAiText={setAiText} askAI={askAI} aiLoading={aiLoading}
            aiPreview={aiPreview} setAiPreview={setAiPreview} aiError={aiError} confirmAiPreview={confirmAiPreview}
            fixedItems={fixedItems} deleteFixedItem={deleteFixedItem} fixedNet={fixedNet}
            applyFixedThisMonth={applyFixedThisMonth} needsApply={needsApply} />
        )}

        {tab === "movimientos" && (
          <Movimientos form={form} setForm={setForm} saveEntry={saveEntry} entries={entries} deleteEntry={deleteEntry}
            handleCSV={handleCSV} exportCSV={exportCSV} editingId={editingId} cancelEdit={cancelEdit}
            startEdit={startEdit} filter={filter} setFilter={setFilter} />
        )}

        {tab === "presupuestos" && (
          <Presupuestos budgets={budgets} setBudget={setBudget} spentByCat={spentByCat} entries={entries} curMonth={curMonth} />
        )}

        {tab === "patrimonio" && (
          <Patrimonio accounts={accounts} addAccount={addAccount} deleteAccount={deleteAccount} wealth={wealth} cashflow={totals.net} />
        )}

        {tab === "proyeccion" && (
          <Proyeccion proj={proj} setProj={setProj} avgMonthlySave={avgMonthlySave} projectionData={projectionData}
            monthsToTarget={monthsToTarget} finalBalance={finalBalance} netActual={netWorth} fixedItems={fixedItems} fixedNet={fixedNet} />
        )}
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1c2433", border: "1px solid #d4af37", color: "#e9ecf1", padding: "10px 18px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, zIndex: 50
        }}>
          <Flame size={14} color="#d4af37" /> {toast}
        </div>
      )}
    </div>
    </FmtCtx.Provider>
  );
}

function StatCard({ label, value, color, icon: Icon }) {
  const fmt = useFmt();
  return (
    <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8a93a3", fontSize: 12, fontWeight: 600 }}>
        <Icon size={14} /> {label}
      </div>
      <div className="sg" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: color || "#e9ecf1" }}>{fmt(value)}</div>
    </div>
  );
}

function Dashboard({ totals, monthly, entries, avgMonthlySave, fixedItems, fixedNet, wealth, netWorth, hasAccounts, budgetAlerts, needsApply, applyFixedThisMonth, curMonth, goTo, startEdit }) {
  const fmt = useFmt();
  return (
    <div>
      {needsApply && (
        <div style={{ background: "#1c2433", border: "1px solid #d4af37", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "#d4af37", display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={14} /> Tienes {fixedItems.length} conceptos fijos sin registrar en {curMonth}.
          </span>
          <button onClick={applyFixedThisMonth} style={{ background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12 }}>
            Aplicar este mes
          </button>
        </div>
      )}
      {(budgetAlerts.over > 0 || budgetAlerts.warning > 0) && (
        <div onClick={() => goTo("presupuestos")} style={{ cursor: "pointer", background: "#2a1c1c", border: "1px solid #e25c5c", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#e8a0a0", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} color="#e25c5c" />
          {budgetAlerts.over > 0 && <span>{budgetAlerts.over} presupuesto(s) rebasado(s).</span>}
          {budgetAlerts.warning > 0 && <span>{budgetAlerts.warning} cerca del límite.</span>}
          <span style={{ color: "#8a93a3" }}>Ver presupuestos →</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Ingresos totales" value={totals.income} color="#2ecc71" icon={TrendingUp} />
        <StatCard label="Gastos totales" value={totals.expense} color="#e25c5c" icon={Wallet} />
        <StatCard label={hasAccounts ? "Patrimonio neto" : "Flujo acumulado"} value={netWorth} color="#d4af37" icon={Award} />
        <StatCard label="Ahorro promedio/mes" value={avgMonthlySave} color="#3fa9f5" icon={Target} />
      </div>

      {hasAccounts && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <StatCard label="Activos" value={wealth.assets} color="#2ecc71" icon={Landmark} />
          <StatCard label="Deudas" value={wealth.debts} color="#e25c5c" icon={PiggyBank} />
        </div>
      )}

      {monthly.length > 0 ? (
        <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ingresos vs gastos por mes</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
              <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} />
              <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Ingresos" fill="#2ecc71" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Gastos" fill="#e25c5c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState text="Registra tu primer movimiento en la pestaña 'Movimientos' para ver tu tablero cobrar vida." />
      )}

      {entries.length > 0 && (
        <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Últimos movimientos</div>
          {entries.slice(0, 5).map(e => (
            <div key={e.id} onClick={() => startEdit(e)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #20283480", fontSize: 13 }}>
              <span style={{ color: "#8a93a3" }}>{e.date} · {e.category}</span>
              <span style={{ fontWeight: 600, color: e.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ background: "#161d29", border: "1px dashed #29323f", borderRadius: 12, padding: 28, textAlign: "center", color: "#8a93a3", fontSize: 13 }}>
      {text}
    </div>
  );
}

function Movimientos({ form, setForm, saveEntry, entries, deleteEntry, handleCSV, exportCSV, editingId, cancelEdit, startEdit, filter, setFilter }) {
  const fmt = useFmt();
  const cats = form.type === "income" ? CATS_INCOME : CATS_EXPENSE;
  const allCats = useMemo(() => Array.from(new Set(entries.map(e => e.category))).sort(), [entries]);

  const filtered = useMemo(() => entries.filter(e => {
    if (filter.type !== "all" && e.type !== filter.type) return false;
    if (filter.category !== "all" && e.category !== filter.category) return false;
    if (filter.from && e.date < filter.from) return false;
    if (filter.to && e.date > filter.to) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      if (!((e.note || "").toLowerCase().includes(q) || e.category.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [entries, filter]);

  const clearFilters = () => setFilter({ q: "", type: "all", category: "all", from: "", to: "" });
  const hasFilters = filter.q || filter.type !== "all" || filter.category !== "all" || filter.from || filter.to;

  return (
    <div>
      <div style={{ background: "#161d29", border: editingId ? "1px solid #d4af37" : "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Editar movimiento" : "Registrar movimiento"}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {["expense", "income"].map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category: t === "income" ? CATS_INCOME[0] : CATS_EXPENSE[0] }))}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #29323f",
                background: form.type === t ? (t === "income" ? "#2ecc7122" : "#e25c5c22") : "transparent",
                color: form.type === t ? (t === "income" ? "#2ecc71" : "#e25c5c") : "#8a93a3",
                fontWeight: 700, fontSize: 13
              }}>
              {t === "income" ? "Ingreso" : "Gasto"}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Monto" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input type="text" placeholder="Nota (opcional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={saveEntry} style={{ flex: 1, background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {editingId ? <><Check size={15} /> Guardar cambios</> : <><Plus size={15} /> Agregar</>}
          </button>
          {editingId ? (
            <button onClick={cancelEdit} style={{ flex: 1, border: "1px solid #29323f", background: "transparent", color: "#8a93a3", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <X size={15} /> Cancelar
            </button>
          ) : (
            <label style={{ flex: 1, border: "1px solid #29323f", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#8a93a3" }}>
              <Upload size={15} /> Importar CSV
              <input type="file" accept=".csv" hidden onChange={e => e.target.files[0] && handleCSV(e.target.files[0])} />
            </label>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#5a6372", marginTop: 8 }}>
          CSV con columnas: date, type (income/expense), category, amount, note
        </div>
      </div>

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700 }}>Historial ({filtered.length}{hasFilters ? `/${entries.length}` : ""})</div>
          <button onClick={exportCSV} style={{ background: "transparent", border: "1px solid #29323f", color: "#8a93a3", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 160px" }}>
            <Search size={13} color="#5a6372" style={{ position: "absolute", left: 10, top: 11 }} />
            <input value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} placeholder="Buscar nota o categoría" style={{ width: "100%", paddingLeft: 30 }} />
          </div>
          <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} style={{ fontSize: 13 }}>
            <option value="all">Todos</option>
            <option value="income">Ingresos</option>
            <option value="expense">Gastos</option>
          </select>
          <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} style={{ fontSize: 13 }}>
            <option value="all">Toda categoría</option>
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} title="Desde" style={{ fontSize: 13 }} />
          <input type="date" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} title="Hasta" style={{ fontSize: 13 }} />
          {hasFilters && (
            <button onClick={clearFilters} style={{ background: "transparent", border: "1px solid #29323f", color: "#8a93a3", borderRadius: 8, padding: "0 12px", fontSize: 12 }}>Limpiar</button>
          )}
        </div>

        {entries.length === 0 && <EmptyState text="Aún no hay movimientos." />}
        {entries.length > 0 && filtered.length === 0 && <EmptyState text="Ningún movimiento coincide con los filtros." />}
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {filtered.map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #20283480" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.category}{e.note ? ` · ${e.note}` : ""}</div>
                <div style={{ fontSize: 11, color: "#5a6372" }}>{e.date}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: e.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                  {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                </span>
                <button onClick={() => startEdit(e)} style={{ background: "none", border: "none", color: "#5a6372" }} title="Editar">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteEntry(e.id)} style={{ background: "none", border: "none", color: "#5a6372" }} title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Presupuestos({ budgets, setBudget, spentByCat, entries, curMonth }) {
  const fmt = useFmt();
  const [cat, setCat] = useState(CATS_EXPENSE[0]);
  const [amount, setAmount] = useState("");

  const extraCats = useMemo(() => {
    const seen = new Set(CATS_EXPENSE);
    return Array.from(new Set(entries.filter(e => e.type === "expense").map(e => e.category))).filter(c => !seen.has(c));
  }, [entries]);
  const catOptions = [...CATS_EXPENSE, ...extraCats];

  const add = () => {
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    setBudget(cat, v);
    setAmount("");
  };

  const rows = Object.keys(budgets).sort();
  const totalBudget = rows.reduce((a, c) => a + budgets[c], 0);
  const totalSpent = rows.reduce((a, c) => a + (spentByCat[c] || 0), 0);

  return (
    <div>
      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Presupuestos mensuales</div>
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>
          Define un límite por categoría. Te avisamos al 80% y al rebasarlo. Gasto del mes en curso ({curMonth}).
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ flex: "1 1 160px" }}>
            {catOptions.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Límite mensual" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: "1 1 120px" }} />
          <button onClick={add} style={{ background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "0 18px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={15} /> Definir
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <StatCard label="Presupuesto total" value={totalBudget} color="#3fa9f5" icon={PiggyBank} />
          <StatCard label="Gastado este mes" value={totalSpent} color={totalSpent > totalBudget ? "#e25c5c" : "#2ecc71"} icon={Wallet} />
          <StatCard label="Disponible" value={Math.max(0, totalBudget - totalSpent)} color="#d4af37" icon={Target} />
        </div>
      )}

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Seguimiento</div>
        {rows.length === 0 && <EmptyState text="Define un presupuesto arriba para empezar a controlar tus gastos por categoría." />}
        {rows.map(c => {
          const limit = budgets[c];
          const spent = spentByCat[c] || 0;
          const pct = Math.min(100, (spent / limit) * 100);
          const over = spent >= limit;
          const warn = !over && spent >= limit * 0.8;
          const color = over ? "#e25c5c" : warn ? "#d4af37" : "#2ecc71";
          return (
            <div key={c} style={{ padding: "10px 0", borderBottom: "1px solid #20283480" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {(over || warn) && <AlertTriangle size={13} color={color} />} {c}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#8a93a3" }}>{fmt(spent)} / {fmt(limit)}</span>
                  <button onClick={() => setBudget(c, 0)} style={{ background: "none", border: "none", color: "#5a6372" }} title="Quitar">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div style={{ width: "100%", height: 7, background: "#0c1118", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .4s" }} />
              </div>
              {over && <div style={{ fontSize: 11, color: "#e25c5c", marginTop: 4 }}>Rebasaste el presupuesto por {fmt(spent - limit)}.</div>}
              {warn && <div style={{ fontSize: 11, color: "#d4af37", marginTop: 4 }}>Vas al {Math.round(pct)}% del límite.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Patrimonio({ accounts, addAccount, deleteAccount, wealth, cashflow }) {
  const fmt = useFmt();
  const [acc, setAcc] = useState({ name: "", type: "asset", balance: "" });

  const submit = () => {
    const balance = parseFloat(acc.balance);
    if (!acc.name.trim() || !balance || balance <= 0) return;
    addAccount({ name: acc.name.trim(), type: acc.type, balance });
    setAcc({ name: "", type: "asset", balance: "" });
  };

  const assets = accounts.filter(a => a.type === "asset");
  const debts = accounts.filter(a => a.type === "debt");

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Activos" value={wealth.assets} color="#2ecc71" icon={Landmark} />
        <StatCard label="Deudas" value={wealth.debts} color="#e25c5c" icon={PiggyBank} />
        <StatCard label="Patrimonio neto" value={wealth.net} color="#d4af37" icon={Award} />
      </div>

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Agregar cuenta</div>
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>
          Registra lo que tienes (cuentas, inversiones, propiedades) y lo que debes (tarjetas, préstamos). El patrimonio neto = activos − deudas.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {["asset", "debt"].map(t => (
            <button key={t} onClick={() => setAcc(a => ({ ...a, type: t }))}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #29323f",
                background: acc.type === t ? (t === "asset" ? "#2ecc7122" : "#e25c5c22") : "transparent",
                color: acc.type === t ? (t === "asset" ? "#2ecc71" : "#e25c5c") : "#8a93a3",
                fontWeight: 700, fontSize: 13
              }}>
              {t === "asset" ? "Activo" : "Deuda"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={acc.name} onChange={e => setAcc(a => ({ ...a, name: e.target.value }))} placeholder={acc.type === "asset" ? "Ej. Cuenta de ahorro" : "Ej. Tarjeta de crédito"} style={{ flex: "1 1 180px" }} />
          <input type="number" value={acc.balance} onChange={e => setAcc(a => ({ ...a, balance: e.target.value }))} placeholder="Monto" style={{ flex: "1 1 120px" }} />
          <button onClick={submit} style={{ background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "0 18px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Agregar
          </button>
        </div>
      </div>

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Tus cuentas</div>
        {accounts.length === 0 && <EmptyState text="Agrega tus activos y deudas para ver tu patrimonio neto real (no solo tu flujo de caja)." />}
        {assets.length > 0 && <div style={{ fontSize: 11, color: "#2ecc71", fontWeight: 700, margin: "6px 0" }}>ACTIVOS</div>}
        {assets.map(a => <AccountRow key={a.id} a={a} onDelete={deleteAccount} />)}
        {debts.length > 0 && <div style={{ fontSize: 11, color: "#e25c5c", fontWeight: 700, margin: "10px 0 6px" }}>DEUDAS</div>}
        {debts.map(a => <AccountRow key={a.id} a={a} onDelete={deleteAccount} />)}
      </div>
    </div>
  );
}

function AccountRow({ a, onDelete }) {
  const fmt = useFmt();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #20283480" }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: a.type === "asset" ? "#2ecc71" : "#e25c5c" }}>
          {a.type === "asset" ? "" : "-"}{fmt(a.balance)}
        </span>
        <button onClick={() => onDelete(a.id)} style={{ background: "none", border: "none", color: "#5a6372" }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function Asistente({ aiText, setAiText, askAI, aiLoading, aiPreview, setAiPreview, aiError, confirmAiPreview, fixedItems, deleteFixedItem, fixedNet, applyFixedThisMonth, needsApply }) {
  const fmt = useFmt();
  const toggleItem = (id) => {
    setAiPreview(prev => prev.map(p => p.id === id ? { ...p, include: !p.include } : p));
  };
  const updateAmount = (id, val) => {
    setAiPreview(prev => prev.map(p => p.id === id ? { ...p, amount: parseFloat(val) || 0 } : p));
  };

  return (
    <div>
      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={16} color="#d4af37" /> Describe tu situación
        </div>
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>
          Cuéntame en tus palabras tus ingresos y gastos fijos, como si le hablaras a un asesor. Yo lo convierto en datos.
        </div>
        <textarea
          value={aiText}
          onChange={e => setAiText(e.target.value)}
          placeholder="Ej: Trabajo en una empresa de IA, gano $7000 al mes fijo. Pago $3000 de gastos fijos: renta $1800, comida $800, transporte $400. También tengo una deuda de tarjeta de $500 al mes."
          rows={5}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }}
        />
        <button onClick={askAI} disabled={aiLoading || !aiText.trim()}
          style={{
            background: aiLoading ? "#29323f" : "#d4af37", color: aiLoading ? "#8a93a3" : "#0c1118",
            border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13,
            display: "flex", alignItems: "center", gap: 6
          }}>
          {aiLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {aiLoading ? "Analizando..." : "Llenar mis datos"}
        </button>
        {aiError && <div style={{ color: "#e25c5c", fontSize: 12, marginTop: 10 }}>{aiError}</div>}
      </div>

      {aiPreview && (
        <div style={{ background: "#161d29", border: "1px solid #d4af37", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Esto entendí — revisa y ajusta</div>
          <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 12 }}>Destilda lo que no quieras guardar, o corrige el monto.</div>
          {aiPreview.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #20283480" }}>
              <input type="checkbox" checked={item.include} onChange={() => toggleItem(item.id)} style={{ width: 16, height: 16 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                  {item.type === "income" ? "Ingreso" : "Gasto"} · {item.category}
                </div>
                {item.note && <div style={{ fontSize: 11, color: "#5a6372" }}>{item.note}</div>}
              </div>
              <input type="number" value={item.amount} onChange={e => updateAmount(item.id, e.target.value)} style={{ width: 100 }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={confirmAiPreview} style={{ flex: 1, background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Check size={15} /> Guardar
            </button>
            <button onClick={() => setAiPreview(null)} style={{ flex: 1, background: "transparent", border: "1px solid #29323f", color: "#8a93a3", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <X size={15} /> Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div className="sg" style={{ fontSize: 14, fontWeight: 700 }}>
            Tus conceptos fijos {fixedItems.length > 0 && `(neto ${fmt(fixedNet.net)}/mes)`}
          </div>
          {fixedItems.length > 0 && (
            <button onClick={applyFixedThisMonth} disabled={!needsApply}
              style={{ background: needsApply ? "#d4af37" : "#29323f", color: needsApply ? "#0c1118" : "#8a93a3", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={13} /> {needsApply ? "Aplicar a este mes" : "Ya aplicados este mes"}
            </button>
          )}
        </div>
        {fixedItems.length === 0 && <EmptyState text="Cuando guardes conceptos, aquí queda tu plantilla mensual fija — aplícala cada mes con un clic y la proyección la usa por default." />}
        {fixedItems.map(f => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #20283480" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{f.category}{f.note ? ` · ${f.note}` : ""}</div>
              <div style={{ fontSize: 11, color: "#5a6372" }}>{f.type === "income" ? "Ingreso fijo" : "Gasto fijo"} mensual</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: f.type === "income" ? "#2ecc71" : "#e25c5c" }}>
                {f.type === "income" ? "+" : "-"}{fmt(f.amount)}
              </span>
              <button onClick={() => deleteFixedItem(f.id)} style={{ background: "none", border: "none", color: "#5a6372" }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Proyeccion({ proj, setProj, avgMonthlySave, projectionData, monthsToTarget, finalBalance, netActual, fixedItems, fixedNet }) {
  const fmt = useFmt();
  return (
    <div>
      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Simulador de futuro</div>
        <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 14 }}>
          Como en Rat Race: proyecta a dónde te llevan tus números si sigues igual, o si quieres comprar algo grande.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Meses a proyectar</label>
            <input type="number" value={proj.months} onChange={e => setProj(p => ({ ...p, months: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Aportación mensual</label>
            <input type="number" placeholder={`Auto: ${fmt(fixedItems.length > 0 ? fixedNet.net : avgMonthlySave)}`} value={proj.monthlyContribution}
              onChange={e => setProj(p => ({ ...p, monthlyContribution: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Rendimiento anual % (opcional)</label>
            <input type="number" value={proj.rate} onChange={e => setProj(p => ({ ...p, rate: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#8a93a3" }}>Meta / compra objetivo (opcional)</label>
            <input type="number" placeholder="Ej. 35000 para la moto" value={proj.target} onChange={e => setProj(p => ({ ...p, target: e.target.value }))} style={{ width: "100%", marginTop: 4 }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Patrimonio actual" value={netActual} color="#e9ecf1" icon={Wallet} />
        <StatCard label={`En ${proj.months} meses`} value={finalBalance} color="#d4af37" icon={TrendingUp} />
        {monthsToTarget !== null && (
          <div style={{ background: "#161d29", border: "1px solid #2ecc71", borderRadius: 12, padding: 16, flex: 1, minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2ecc71", fontSize: 12, fontWeight: 600 }}>
              <Target size={14} /> Llegas a tu meta en
            </div>
            <div className="sg" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "#2ecc71" }}>
              {monthsToTarget} {monthsToTarget === 1 ? "mes" : "meses"}
            </div>
          </div>
        )}
        {proj.target && monthsToTarget === null && (
          <div style={{ background: "#161d29", border: "1px solid #e25c5c", borderRadius: 12, padding: 16, flex: 1, minWidth: 180 }}>
            <div style={{ color: "#e25c5c", fontSize: 12, fontWeight: 600 }}>Con este ritmo, no alcanzas la meta en 100 años</div>
            <div style={{ fontSize: 12, color: "#8a93a3", marginTop: 6 }}>Sube tu aportación mensual o baja la meta</div>
          </div>
        )}
      </div>

      <div style={{ background: "#161d29", border: "1px solid #29323f", borderRadius: 12, padding: 16 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Tu ruta hacia la libertad</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
            <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} label={{ value: "meses", position: "insideBottom", offset: -3, fill: "#5a6372", fontSize: 11 }} />
            <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt(v)} labelFormatter={(l) => `Mes ${l}`} />
            <Line type="monotone" dataKey="balance" stroke="#d4af37" strokeWidth={2.5} dot={false} />
            {proj.target && <Line type="monotone" dataKey={() => parseFloat(proj.target)} stroke="#e25c5c" strokeDasharray="4 4" dot={false} name="Meta" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
