import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AdminDashboard.css';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

// "2026-02-26" → "26 Feb 2026"
function formatFecha(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

// "2026-04-10" → "Viernes 10 de Abril"
function formatFechaDia(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase());
}

// "18:00" + 90 → "18:00 - 19:30"
function horaRango(hora, duracion) {
  if (!hora) return '—';
  const [hh, mm] = hora.split(':').map(Number);
  const mins = (mm || 0) + (parseInt(duracion) || 0);
  const endH = String(hh + Math.floor(mins / 60)).padStart(2, '0');
  const endM = String(mins % 60).padStart(2, '0');
  return duracion ? `${hora} - ${endH}:${endM}` : hora;
}

// Returns a JSX status badge for a reserva
function EstadoBadge({ reserva }) {
  if (reserva.estado === 'cancelada' || reserva.cancelada) {
    return <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>❌ Cancelada</span>;
  }
  if (reserva.estado === 'reservada') {
    return <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>📋 Reservada</span>;
  }
  if (reserva.estado === 'completada' || !esFutura(reserva)) {
    return <span style={{ background: '#e2e8f0', color: '#475569', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>✅ Completada</span>;
  }
  return <span style={{ background: '#ede9fe', color: '#3b2f6e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>🟢 Confirmada</span>;
}

// Returns true if the reserva's fecha+hora is in the future
function esFutura(reserva) {
  if (!reserva.fecha) return false;
  const [y, m, d] = reserva.fecha.split('-').map(Number);
  const [hh = 23, mm = 59] = (reserva.hora || '23:59').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm) > new Date();
}

// Build a lookup: country name (lowercase) → flag emoji
const FLAG_MAP = {};
[...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach(p => {
  FLAG_MAP[p.nombre.toLowerCase()] = p.bandera;
});

function sedeFlag(sede) {
  if (!sede?.pais) return '';
  const pais = sede.pais.trim();
  // Already starts with a flag emoji (multi-char emoji code point)
  if ([...pais][0]?.match(/\p{Emoji_Presentation}/u)) return [...pais][0];
  // Plain country name — look it up
  return FLAG_MAP[pais.toLowerCase()] || '';
}

export default function AdminDashboard({ handleLogout, apiBaseUrl = 'https://padbol-backend.onrender.com' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentEmail = (JSON.parse(localStorage.getItem('currentCliente') || '{}')?.email || '').trim().toLowerCase();
  const isSuperAdmin = currentEmail === 'padbolinternacional@gmail.com';
  const isAdmin = ['padbolinternacional@gmail.com', 'admin@padbol.com', 'sm@padbol.com', 'juanpablo@padbol.com'].includes(currentEmail);

  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [sedesMap, setSedesMap] = useState({});
  const [ingresos, setIngresos] = useState({ ARS: 0, USD: 0, EUR: 0 });
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || sessionStorage.getItem('adminActiveTab') || 'resumen'
  );

  const [pendientes, setPendientes] = useState([]);
  const [pendientesLoading, setPendientesLoading] = useState(true);
  // keyed by player email: { open: bool, categoria: string, saving: bool }
  const [validacionState, setValidacionState] = useState({});

  useEffect(() => {
    fetchData();
    fetchPendientes();
  }, [apiBaseUrl]);

  const fetchPendientes = async () => {
    setPendientesLoading(true);
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('email, nombre, pais, nivel')
      .eq('pendiente_validacion', true)
      .order('nombre');
    if (!error) setPendientes(data || []);
    setPendientesLoading(false);
  };

  const aprobarJugador = async (email) => {
    setValidacionState(prev => ({ ...prev, [email]: { ...prev[email], saving: true } }));
    await supabase
      .from('jugadores_perfil')
      .update({ pendiente_validacion: false })
      .eq('email', email);
    setPendientes(prev => prev.filter(p => p.email !== email));
    setValidacionState(prev => { const s = { ...prev }; delete s[email]; return s; });
  };

  const guardarCategoria = async (email) => {
    const nuevaCategoria = validacionState[email]?.categoria;
    if (!nuevaCategoria) return;
    setValidacionState(prev => ({ ...prev, [email]: { ...prev[email], saving: true } }));
    await supabase
      .from('jugadores_perfil')
      .update({ nivel: nuevaCategoria, pendiente_validacion: false })
      .eq('email', email);
    setPendientes(prev => prev.filter(p => p.email !== email));
    setValidacionState(prev => { const s = { ...prev }; delete s[email]; return s; });
  };

  const toggleCambiarCategoria = (email, nivelActual) => {
    setValidacionState(prev => ({
      ...prev,
      [email]: {
        open: !prev[email]?.open,
        categoria: prev[email]?.categoria || nivelActual,
        saving: false,
      },
    }));
  };

  const eliminarTorneo = async (torneoId, torneoNombre) => {
    if (!window.confirm(`¿Eliminar el torneo "${torneoNombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, { method: 'DELETE' });
      if (res.ok) {
        setTorneos(prev => prev.filter(t => t.id !== torneoId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert('Error al eliminar: ' + (data.error || res.statusText));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const [editandoTorneoId, setEditandoTorneoId] = useState(null);
  const [editTorneoForm, setEditTorneoForm] = useState({});
  const [savingTorneo, setSavingTorneo] = useState(false);
  const [torneoStats, setTorneoStats] = useState({});

  // ── Config puntos (superAdmin only) ──
  const CONFIG_NIVELES_DEFAULT    = { club_no_oficial: 10, club_oficial: 30, nacional: 100, internacional: 300, mundial: 1000 };
  const CONFIG_POSICIONES_DEFAULT = { 1: 100, 2: 60, 3: 40, 4: 25, 5: 15, 6: 10, 7: 5, 8: 5, 9: 5, 10: 5 };

  const loadConfigFromStorage = () => {
    try {
      const raw = localStorage.getItem('config_puntos');
      return raw ? JSON.parse(raw) : { niveles: CONFIG_NIVELES_DEFAULT, posiciones: CONFIG_POSICIONES_DEFAULT };
    } catch { return { niveles: CONFIG_NIVELES_DEFAULT, posiciones: CONFIG_POSICIONES_DEFAULT }; }
  };

  const [configNiveles,    setConfigNiveles]    = useState(() => loadConfigFromStorage().niveles);
  const [configPosiciones, setConfigPosiciones] = useState(() => loadConfigFromStorage().posiciones);
  const [configSaving,     setConfigSaving]     = useState(false);
  const [configMsg,        setConfigMsg]        = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch(`${apiBaseUrl}/api/config/puntos`)
      .then(r => r.json())
      .then(data => {
        if (data.niveles)    { setConfigNiveles(data.niveles);       }
        if (data.posiciones) { setConfigPosiciones(data.posiciones); }
        localStorage.setItem('config_puntos', JSON.stringify({ niveles: data.niveles, posiciones: data.posiciones }));
      })
      .catch(() => {});
  }, [isSuperAdmin, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarConfig = async () => {
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const body = { niveles: configNiveles, posiciones: configPosiciones };
      localStorage.setItem('config_puntos', JSON.stringify(body));
      const res = await fetch(`${apiBaseUrl}/api/config/puntos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setConfigMsg('✅ Configuración guardada'); }
      else        { setConfigMsg('⚠️ Guardado local OK, error en servidor'); }
    } catch {
      setConfigMsg('⚠️ Sin conexión — guardado solo en local');
    } finally {
      setConfigSaving(false);
      setTimeout(() => setConfigMsg(''), 3000);
    }
  };

  useEffect(() => {
    if (activeTab !== 'torneos' || torneos.length === 0) return;
    let cancelled = false;
    const fetchTorneoStats = async () => {
      const results = await Promise.all(
        torneos.map(async (t) => {
          try {
            const [eqRes, partRes] = await Promise.all([
              fetch(`${apiBaseUrl}/api/torneos/${t.id}/equipos`),
              fetch(`${apiBaseUrl}/api/torneos/${t.id}/partidos`),
            ]);
            const equipos  = eqRes.ok  ? await eqRes.json()  : [];
            const partidos = partRes.ok ? await partRes.json() : [];
            const jugados  = partidos.filter(p => p.estado === 'finalizado').length;
            // winner: equipo with highest puntos_ranking (finalizado) or puntos_totales (en_curso)
            const sorted = [...equipos].sort((a, b) =>
              t.estado === 'finalizado'
                ? (b.puntos_ranking || 0) - (a.puntos_ranking || 0)
                : (b.puntos_totales || 0) - (a.puntos_totales || 0)
            );
            return { id: t.id, equipos_count: equipos.length, partidos_jugados: jugados, total_partidos: partidos.length, winner: sorted[0] || null };
          } catch {
            return { id: t.id, equipos_count: 0, partidos_jugados: 0, total_partidos: 0, winner: null };
          }
        })
      );
      if (!cancelled) {
        const map = {};
        results.forEach(r => { map[r.id] = r; });
        setTorneoStats(map);
      }
    };
    fetchTorneoStats();
    return () => { cancelled = true; };
  }, [activeTab, torneos.length, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEditTorneo = (torneo) => {
    setEditandoTorneoId(torneo.id);
    setEditTorneoForm({
      nombre:       torneo.nombre       || '',
      nivel_torneo: torneo.nivel_torneo || '',
      tipo_torneo:  torneo.tipo_torneo  || '',
      fecha_inicio: torneo.fecha_inicio || '',
      fecha_fin:    torneo.fecha_fin    || '',
      sede_id:      torneo.sede_id      != null ? String(torneo.sede_id) : '',
    });
  };

  const guardarTorneo = async (torneoId) => {
    setSavingTorneo(true);
    try {
      const body = {
        ...editTorneoForm,
        sede_id: editTorneoForm.sede_id ? parseInt(editTorneoForm.sede_id) : null,
      };
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setTorneos(prev => prev.map(t => t.id === torneoId ? { ...t, ...body } : t));
        setEditandoTorneoId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert('Error al guardar: ' + (data.error || res.statusText));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSavingTorneo(false);
    }
  };

  const fetchData = async () => {
    try {
      // Cargar sedes primero para poder resolver moneda por sede
      let sedesData = [];
      try {
        const sedesRes = await fetch(`${apiBaseUrl}/api/sedes`);
        if (sedesRes.ok) {
          sedesData = await sedesRes.json() || [];
          const map = {};
          sedesData.forEach(s => { map[s.id] = s; });
          setSedesMap(map);
        }
      } catch { /* sedes opcionales */ }

      // nombre de sede → moneda (ej: "Padbol Vienna" → "EUR")
      const sedeMonedaMap = {};
      sedesData.forEach(s => {
        if (s.nombre && s.moneda) sedeMonedaMap[s.nombre.trim().toLowerCase()] = s.moneda;
      });

      // Cargar reservas
      const resRes = await fetch(`${apiBaseUrl}/api/reservas`);
      const resData = await resRes.json();
      setReservas(resData);

      const totales = { ARS: 0, USD: 0, EUR: 0 };
      resData.forEach(item => {
        // Priority: reserva.moneda → sede's moneda → ARS
        const moneda =
          item.moneda ||
          (item.sede ? sedeMonedaMap[item.sede.trim().toLowerCase()] : null) ||
          'ARS';
        if (moneda in totales) totales[moneda] += item.precio || 0;
        else totales.ARS += item.precio || 0;
      });
      setIngresos(totales);

      // Cargar torneos
      const tornRes = await fetch(`${apiBaseUrl}/api/torneos`);
      const tornData = await tornRes.json();
      setTorneos(tornData);

      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  };

  const iniciarEdicion = (reserva) => {
    setEditandoId(reserva.id);
    setEditFormData({ ...reserva, estado: reserva.estado || 'reservada' });
    setMensajeExito('');
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditFormData({});
  };

  const guardarEdicion = async (reservaId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        setMensajeExito('✅ Reserva actualizada');
        setEditandoId(null);
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert('Error al actualizar');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const cancelarReserva = async (reservaId) => {
    if (!window.confirm('¿Cancelar esta reserva?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMensajeExito('✅ Reserva cancelada');
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert('Error al cancelar');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>;

  const TABS = [
    { id: 'resumen',      label: '📊 Resumen' },
    { id: 'torneos',      label: '🏆 Torneos' },
    { id: 'reservas',     label: '📅 Reservas' },
    { id: 'validaciones', label: '⏳ Validaciones', badge: pendientes.length },
    ...(isSuperAdmin ? [{ id: 'config', label: '⚙️ Config' }] : []),
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🏆 PADBOL MATCH - ADMIN</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '5px', cursor: 'pointer' }}>
            ← Inicio
          </button>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.3)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); sessionStorage.setItem('adminActiveTab', tab.id); }}
            style={{
              position: 'relative',
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid white' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              marginBottom: '-2px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: '#d32f2f',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {mensajeExito && (
        <div style={{ background: '#4caf50', color: 'white', padding: '15px', borderRadius: '5px', marginBottom: '20px', textAlign: 'center' }}>
          {mensajeExito}
        </div>
      )}

      {activeTab === 'resumen' && <div className="dashboard-grid">
        <div className="card ingresos">
          <h2>Ingresos Totales</h2>
          <div className="ingresos-por-moneda">
            <div className="ingreso-fila">
              <span className="ingreso-codigo">ARS</span>
              <span className="ingreso-valor">$ {ingresos.ARS.toLocaleString('es-AR')}</span>
            </div>
            <div className="ingreso-fila">
              <span className="ingreso-codigo">USD</span>
              <span className="ingreso-valor">US$ {ingresos.USD.toLocaleString('en-US')}</span>
            </div>
            <div className="ingreso-fila">
              <span className="ingreso-codigo">EUR</span>
              <span className="ingreso-valor">€ {ingresos.EUR.toLocaleString('de-DE')}</span>
            </div>
          </div>
        </div>
        <div className="card reservas">
          <h2>Total Reservas</h2>
          <p className="count">{reservas.length}</p>
        </div>
        <div className="card torneos">
          <h2>Total Torneos</h2>
          <p className="count">{torneos.length}</p>
        </div>
      </div>}

      {activeTab === 'torneos' && <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>📋 Torneos Creados</h2>
          <button
            onClick={() => navigate('/torneo/crear')}
            style={{ padding: '8px 16px', background: '#e53935', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            + Nuevo Torneo
          </button>
        </div>
        {torneos.length === 0 ? (
          <p style={{ color: '#999' }}>Sin torneos</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {torneos.map(torneo => {
              const sede = sedesMap[torneo.sede_id];
              const flag = sedeFlag(sede);
              const NIVEL_COLOR = {
                nacional:        { bg: '#f3f4f6', color: '#374151' },
                club_no_oficial: { bg: '#f5f3ff', color: '#6d28d9' },
                club_oficial:    { bg: '#ede9fe', color: '#5b21b6' },
                internacional:   { bg: '#dbeafe', color: '#1e40af' },
                mundial:         { bg: '#fef3c7', color: '#92400e' },
              };
              const FORMATO_COLOR = {
                round_robin:     { bg: '#ede9fe', color: '#5b21b6' },
                knockout:        { bg: '#fee2e2', color: '#991b1b' },
                grupos_knockout: { bg: '#e0e7ff', color: '#3730a3' },
              };
              const nivelColor   = NIVEL_COLOR[torneo.nivel_torneo]  || { bg: '#f3f4f6', color: '#374151' };
              const formatoColor = FORMATO_COLOR[torneo.tipo_torneo]  || { bg: '#f3f4f6', color: '#374151' };
              const estadoBadge  = {
                planificacion: { bg: '#e5e7eb', color: '#374151', label: 'Planificación' },
                en_curso:      { bg: '#dbeafe', color: '#1d4ed8', label: 'En curso'      },
                finalizado:    { bg: '#fef3c7', color: '#92400e', label: 'Finalizado'    },
              }[torneo.estado] || { bg: '#e5e7eb', color: '#374151', label: torneo.estado };
              // Shared badge style — fixed 120px, centered
              const badge = (bg, col) => ({
                background: bg, color: col,
                borderRadius: '10px', padding: '3px 0',
                fontSize: '11px', fontWeight: '600',
                width: '120px', display: 'block',
                textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              });

              const isEditingThis = editandoTorneoId === torneo.id;
              const inp = { padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };

              return (
                <div key={torneo.id} style={{
                  background: 'white',
                  border: isEditingThis ? '2px solid #667eea' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}>
                  {isEditingThis ? (
                    /* ── Inline edit form ── */
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Nombre</label>
                          <input style={inp} value={editTorneoForm.nombre} onChange={e => setEditTorneoForm(p => ({ ...p, nombre: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Sede</label>
                          <select style={inp} value={editTorneoForm.sede_id} onChange={e => setEditTorneoForm(p => ({ ...p, sede_id: e.target.value }))}>
                            <option value="">— Sin sede —</option>
                            {Object.values(sedesMap).map(s => (
                              <option key={s.id} value={String(s.id)}>{sedeFlag(s)} {s.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Nivel</label>
                          <input style={inp} value={editTorneoForm.nivel_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, nivel_torneo: e.target.value }))} placeholder="Ej: Intermedio" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Formato</label>
                          <select style={inp} value={editTorneoForm.tipo_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, tipo_torneo: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            <option value="round_robin">Round Robin</option>
                            <option value="knockout">Knockout</option>
                            <option value="grupos_knockout">Grupos + Knockout</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha inicio</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_inicio} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha fin</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_fin} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditandoTorneoId(null)}
                          style={{ padding: '6px 14px', background: 'transparent', color: '#666', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          disabled={savingTorneo}
                          onClick={() => guardarTorneo(torneo.id)}
                          style={{ padding: '6px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: savingTorneo ? 0.6 : 1 }}
                        >
                          {savingTorneo ? 'Guardando...' : '✅ Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Compact view: CSS grid keeps columns aligned across all cards ── */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 130px auto', gap: '0 12px', alignItems: 'center' }}>

                      {/* Col 1 — name, sede, status summary */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {flag && <span style={{ fontSize: '18px', flexShrink: 0 }}>{flag}</span>}
                          <strong style={{ fontSize: '14px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneo.nombre}</strong>
                        </div>
                        {sede && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>{sede.nombre}</div>}
                        {(() => {
                          const st = torneoStats[torneo.id];
                          if (!st) return <div style={{ fontSize: '11px', color: '#ddd', marginTop: '3px' }}>···</div>;
                          if (torneo.estado === 'planificacion') return (
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                              🔧 <strong>{st.equipos_count}</strong> equipo{st.equipos_count !== 1 ? 's' : ''} inscripto{st.equipos_count !== 1 ? 's' : ''}
                            </div>
                          );
                          if (torneo.estado === 'en_curso') return (
                            <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '3px' }}>
                              ⚔️ <strong>{st.partidos_jugados}/{st.total_partidos}</strong> partidos
                            </div>
                          );
                          if (torneo.estado === 'finalizado') return (
                            <div style={{ fontSize: '11px', color: '#92400e', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🥇 <strong>{st.winner?.nombre || '—'}</strong>
                            </div>
                          );
                          return null;
                        })()}
                      </div>

                      {/* Col 2 — nivel */}
                      <div>
                        {torneo.nivel_torneo
                          ? <span style={badge(nivelColor.bg, nivelColor.color)}>{torneo.nivel_torneo}</span>
                          : <span style={{ color: '#ddd', fontSize: '11px', display: 'block', width: '120px', textAlign: 'center' }}>—</span>}
                      </div>

                      {/* Col 3 — formato */}
                      <div>
                        {torneo.tipo_torneo
                          ? <span style={badge(formatoColor.bg, formatoColor.color)}>{torneo.tipo_torneo.replace(/_/g, ' ')}</span>
                          : <span style={{ color: '#ddd', fontSize: '11px', display: 'block', width: '120px', textAlign: 'center' }}>—</span>}
                      </div>

                      {/* Col 4 — estado */}
                      <div>
                        <span style={badge(estadoBadge.bg, estadoBadge.color)}>{estadoBadge.label}</span>
                      </div>

                      {/* Col 5 — dates (2 lines) */}
                      <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                        {torneo.fecha_inicio
                          ? <>
                              <div style={{ color: '#374151' }}>{formatFecha(torneo.fecha_inicio)}</div>
                              {torneo.fecha_fin && <div style={{ color: '#aaa' }}>→ {formatFecha(torneo.fecha_fin)}</div>}
                            </>
                          : <div style={{ color: '#ddd' }}>—</div>}
                      </div>

                      {/* Col 6 — actions */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => navigate(`/torneo/${torneo.id}/vista`)}
                          style={{ padding: '6px 14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                        >
                          Ver →
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => abrirEditTorneo(torneo)}
                            style={{ padding: '6px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title="Editar torneo"
                          >
                            ✏️
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => eliminarTorneo(torneo.id, torneo.nombre)}
                            style={{ padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title="Eliminar torneo"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {activeTab === 'validaciones' && <div className="section">
        <h2>⏳ Jugadores Pendientes de Validación</h2>
        {pendientesLoading ? (
          <p style={{ color: '#999' }}>Cargando...</p>
        ) : pendientes.length === 0 ? (
          <p style={{ color: '#999' }}>No hay jugadores pendientes de validación.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {pendientes.map(jugador => {
              const flag = (jugador.pais || '').split(' ')[0];
              const vs = validacionState[jugador.email] || {};
              return (
                <div key={jugador.email} style={{ background: 'white', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <strong style={{ fontSize: '15px' }}>{jugador.nombre}</strong>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>{jugador.email}</div>
                    <div style={{ marginTop: '5px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {flag && <span style={{ fontSize: '18px' }}>{flag}</span>}
                      <span style={{ background: '#fffde7', border: '1px solid #ffc107', color: '#7c5b00', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 'bold' }}>
                        {jugador.nivel}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <button
                      disabled={vs.saving}
                      onClick={() => aprobarJugador(jugador.email)}
                      style={{ padding: '7px 14px', background: '#43a047', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      disabled={vs.saving}
                      onClick={() => toggleCambiarCategoria(jugador.email, jugador.nivel)}
                      style={{ padding: '7px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      ✏️ Cambiar categoría
                    </button>

                    {vs.open && (
                      <>
                        <select
                          value={vs.categoria || jugador.nivel}
                          onChange={e => setValidacionState(prev => ({ ...prev, [jugador.email]: { ...prev[jugador.email], categoria: e.target.value } }))}
                          style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '13px' }}
                        >
                          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          disabled={vs.saving}
                          onClick={() => guardarCategoria(jugador.email)}
                          style={{ padding: '7px 14px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                        >
                          {vs.saving ? 'Guardando...' : '💾 Guardar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {activeTab === 'reservas' && <div className="section">
        {(() => {
          const proximas    = reservas.filter(esFutura).sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
          const completadas = reservas.filter(r => !esFutura(r)).sort((a, b) => (a.fecha + a.hora) > (b.fecha + b.hora) ? -1 : 1);

          const buildGroups = (lista) => {
            const g = {};
            lista.forEach(r => { const k = r.fecha || 'Sin fecha'; if (!g[k]) g[k] = []; g[k].push(r); });
            return g;
          };

          const SectionHeaderRow = ({ label, color }) => (
            <tr>
              <td colSpan="8" style={{
                padding: '14px 16px 10px',
                border: 'none',
                borderBottom: `2px solid ${color}`,
                background: 'transparent',
              }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.01em' }}>
                  {label}
                </span>
              </td>
            </tr>
          );

          const DateRow = ({ dia }) => (
            <tr>
              <td colSpan="8" style={{ padding: '10px 16px 4px', border: 'none', background: 'transparent' }}>
                <span style={{
                  display: 'inline-block',
                  background: 'rgba(59,47,110,0.12)',
                  border: '1px solid rgba(59,47,110,0.25)',
                  color: '#3b2f6e',
                  borderRadius: '20px',
                  padding: '3px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}>
                  📅 {formatFechaDia(dia)}
                </span>
              </td>
            </tr>
          );

          const EmptyRow = ({ text }) => (
            <tr>
              <td colSpan="8" style={{ padding: '10px 16px', color: '#aaa', fontSize: '13px', border: 'none' }}>{text}</td>
            </tr>
          );

          const BTN = (extra) => ({
            padding: '4px 10px', border: 'none', borderRadius: '3px',
            cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', color: 'white', ...extra,
          });

          const DataRows = ({ groups }) => Object.keys(groups).map(dia => (
            <React.Fragment key={dia}>
              <DateRow dia={dia} />
              {groups[dia].map(r => (
                <tr key={r.id}>
                  {editandoId === r.id ? (
                    <>
                      <td style={{ padding: '6px 8px' }}><input type="text" value={editFormData.sede || ''} onChange={e => setEditFormData({ ...editFormData, sede: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                          <input type="time" value={editFormData.hora || ''} onChange={e => setEditFormData({ ...editFormData, hora: e.target.value })} style={{ padding: '4px', flex: 1, minWidth: 0 }} />
                          <input type="number" placeholder="min" value={editFormData.duracion || ''} onChange={e => setEditFormData({ ...editFormData, duracion: e.target.value })} style={{ padding: '4px', width: '46px' }} title="Duración en minutos" />
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }}><input type="number" value={editFormData.cancha || ''} onChange={e => setEditFormData({ ...editFormData, cancha: parseInt(e.target.value) })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                      <td style={{ padding: '6px 8px' }}><input type="text" value={editFormData.nombre || ''} onChange={e => setEditFormData({ ...editFormData, nombre: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                      <td style={{ padding: '6px 8px' }}><input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                      <td style={{ padding: '6px 8px' }}><input type="number" value={editFormData.precio || ''} onChange={e => setEditFormData({ ...editFormData, precio: parseInt(e.target.value) })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                      <td style={{ padding: '6px 8px' }}>
                        <select value={editFormData.estado || 'reservada'} onChange={e => setEditFormData({ ...editFormData, estado: e.target.value })} style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', width: '100%' }}>
                          <option value="reservada">📋 Reservada</option>
                          <option value="confirmada">🟢 Confirmada</option>
                          <option value="completada">✅ Completada</option>
                          <option value="cancelada">❌ Cancelada</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => guardarEdicion(r.id)} style={BTN({ background: '#4caf50' })}>✅ Guardar</button>
                          <button onClick={cancelarEdicion} style={BTN({ background: '#999' })}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sede}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{horaRango(r.hora, r.duracion)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>Cancha {r.cancha}</td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>${(r.precio || 30000).toLocaleString('es-AR')}</td>
                      <td><EstadoBadge reserva={r} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => iniciarEdicion(r)} style={BTN({ background: '#667eea' })}>✏️ Editar</button>
                          <button onClick={() => cancelarReserva(r.id)} style={BTN({ background: '#d32f2f' })}>🗑️</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </React.Fragment>
          ));

          return (
            <div className="reservas-table-wrap">
            <table className="reservas-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: '880px', marginTop: 0 }}>
              <colgroup>
                <col style={{ width: '110px' }} />{/* Sede */}
                <col style={{ width: '112px' }} />{/* Horario */}
                <col style={{ width: '88px' }} /> {/* Cancha */}
                <col style={{ width: '120px' }} />{/* Nombre */}
                <col style={{ width: '140px' }} />{/* Email */}
                <col style={{ width: '80px' }} /> {/* Precio */}
                <col style={{ width: '112px' }} />{/* Estado */}
                <col style={{ width: '118px' }} />{/* Acciones */}
              </colgroup>
              <thead>
                <tr>
                  <th>Sede</th>
                  <th>Horario</th>
                  <th>Cancha</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeaderRow label="Próximas reservas" color="#a78bfa" />
                {proximas.length === 0
                  ? <EmptyRow text="Sin reservas próximas." />
                  : <DataRows groups={buildGroups(proximas)} />}

                <SectionHeaderRow label="Reservas completadas" color="#64748b" />
                {completadas.length === 0
                  ? <EmptyRow text="Sin reservas completadas." />
                  : <DataRows groups={buildGroups(completadas)} />}
              </tbody>
            </table>
            </div>
          );
        })()}
      </div>}

      {activeTab === 'config' && isSuperAdmin && <div className="section">
        <h2>⚙️ Configuración de Puntos</h2>

        {/* Niveles de torneo */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
            Puntos base por nivel de torneo
          </h3>
          <table style={{ width: '100%', maxWidth: '480px', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <thead>
              <tr style={{ background: '#3b2f6e', color: 'white' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Nivel</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>Puntos</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'club_no_oficial', label: 'Club No Oficial' },
                { key: 'club_oficial',    label: 'Club Oficial' },
                { key: 'nacional',        label: 'Nacional' },
                { key: 'internacional',   label: 'Internacional' },
                { key: 'mundial',         label: 'Mundial' },
              ].map(({ key, label }, i) => (
                <tr key={key} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                  <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>{label}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      value={configNiveles[key] ?? 0}
                      onChange={e => setConfigNiveles(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                      style={{ width: '80px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold', color: '#3b2f6e' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Distribución por posición */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
            Distribución de puntos por posición (%)
          </h3>
          <table style={{ width: '100%', maxWidth: '480px', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <thead>
              <tr style={{ background: '#3b2f6e', color: 'white' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Posición</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>% de puntos base</th>
              </tr>
            </thead>
            <tbody>
              {[1,2,3,4,5,6,7,8,9,10].map((pos, i) => (
                <tr key={pos} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                  <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>
                    {pos === 1 ? '🥇 1ro' : pos === 2 ? '🥈 2do' : pos === 3 ? '🥉 3ro' : `${pos}°`}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={configPosiciones[pos] ?? 0}
                      onChange={e => setConfigPosiciones(prev => ({ ...prev, [pos]: parseInt(e.target.value) || 0 }))}
                      style={{ width: '80px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold', color: '#3b2f6e' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={guardarConfig}
            disabled={configSaving}
            style={{
              padding: '12px 28px',
              background: configSaving ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #4c1d95)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: configSaving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '15px',
              boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
              opacity: configSaving ? 0.8 : 1,
            }}
          >
            {configSaving ? '⏳ Guardando...' : '💾 Guardar configuración'}
          </button>
          {configMsg && (
            <span style={{ fontSize: '14px', fontWeight: '600', color: configMsg.startsWith('✅') ? '#86efac' : '#fde68a' }}>
              {configMsg}
            </span>
          )}
        </div>
      </div>}

    </div>
  );
}