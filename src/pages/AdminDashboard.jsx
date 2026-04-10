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
  if (esFutura(reserva)) {
    return <span style={{ background: '#ede9fe', color: '#3b2f6e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>🟢 Confirmada</span>;
  }
  return <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>✅ Completada</span>;
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
    setEditFormData({ ...reserva });
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
              const estadoColor = {
                pendiente: '#f59e0b',
                en_curso:  '#2563eb',
                finalizado:'#6b7280',
              }[torneo.estado] || '#6b7280';

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
                    /* ── Compact view ── */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {/* Name + flag */}
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {flag && <span style={{ fontSize: '20px' }}>{flag}</span>}
                          <strong style={{ fontSize: '14px', color: '#111' }}>{torneo.nombre}</strong>
                        </div>
                        {sede && <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{sede.nombre}</div>}
                      </div>

                      {/* Meta pills */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {torneo.nivel_torneo && (
                          <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: '12px', padding: '2px 9px', fontSize: '11px', fontWeight: 'bold' }}>
                            {torneo.nivel_torneo}
                          </span>
                        )}
                        {torneo.tipo_torneo && (
                          <span style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: '12px', padding: '2px 9px', fontSize: '11px', fontWeight: 'bold' }}>
                            {torneo.tipo_torneo}
                          </span>
                        )}
                        <span style={{ background: estadoColor, color: 'white', borderRadius: '12px', padding: '2px 9px', fontSize: '11px', fontWeight: 'bold' }}>
                          {torneo.estado}
                        </span>
                        {torneo.fecha_inicio && (
                          <span style={{ color: '#6b7280', fontSize: '11px' }}>
                            📅 {formatFecha(torneo.fecha_inicio)}{torneo.fecha_fin ? ` → ${formatFecha(torneo.fecha_fin)}` : ''}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => navigate(`/torneo/${torneo.id}/vista`)}
                          style={{ padding: '6px 14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                        >
                          Ver →
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => abrirEditTorneo(torneo)}
                            style={{ padding: '6px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            title="Editar torneo"
                          >
                            ✏️
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => eliminarTorneo(torneo.id, torneo.nombre)}
                            style={{ padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
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
          const proximas   = reservas.filter(esFutura).sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
          const completadas = reservas.filter(r => !esFutura(r)).sort((a, b) => (a.fecha + a.hora) > (b.fecha + b.hora) ? -1 : 1);

          const ReservasTable = ({ lista, accentColor, emptyText }) => {
            if (lista.length === 0) return <p style={{ color: '#aaa', padding: '10px 0', fontSize: '13px' }}>{emptyText}</p>;

            const groups = {};
            lista.forEach(r => {
              const key = r.fecha || 'Sin fecha';
              if (!groups[key]) groups[key] = [];
              groups[key].push(r);
            });

            return (
              <table className="reservas-table" style={{ marginBottom: 0 }}>
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
                  {Object.keys(groups).map(dia => (
                    <React.Fragment key={dia}>
                      <tr>
                        <td colSpan="8" style={{ background: accentColor, color: 'white', fontWeight: 'bold', fontSize: '13px', padding: '7px 12px' }}>
                          📅 {formatFechaDia(dia)}
                        </td>
                      </tr>
                      {groups[dia].map(r => (
                        <tr key={r.id}>
                          {editandoId === r.id ? (
                            <>
                              <td><input type="text" value={editFormData.sede || ''} onChange={e => setEditFormData({ ...editFormData, sede: e.target.value })} style={{ width: '100%', padding: '5px' }} /></td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <input type="time" value={editFormData.hora || ''} onChange={e => setEditFormData({ ...editFormData, hora: e.target.value })} style={{ padding: '5px', flex: 1 }} />
                                  <input type="number" placeholder="min" value={editFormData.duracion || ''} onChange={e => setEditFormData({ ...editFormData, duracion: e.target.value })} style={{ padding: '5px', width: '52px' }} title="Duración en minutos" />
                                </div>
                              </td>
                              <td><input type="number" value={editFormData.cancha || ''} onChange={e => setEditFormData({ ...editFormData, cancha: parseInt(e.target.value) })} style={{ width: '100%', padding: '5px' }} /></td>
                              <td><input type="text" value={editFormData.nombre || ''} onChange={e => setEditFormData({ ...editFormData, nombre: e.target.value })} style={{ width: '100%', padding: '5px' }} /></td>
                              <td><input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} style={{ width: '100%', padding: '5px' }} /></td>
                              <td><input type="number" value={editFormData.precio || ''} onChange={e => setEditFormData({ ...editFormData, precio: parseInt(e.target.value) })} style={{ width: '100%', padding: '5px' }} /></td>
                              <td><EstadoBadge reserva={r} /></td>
                              <td style={{ textAlign: 'center' }}>
                                <button onClick={() => guardarEdicion(r.id)} style={{ padding: '5px 10px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' }}>✅ Guardar</button>
                                <button onClick={cancelarEdicion} style={{ padding: '5px 10px', background: '#999', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕ Cancelar</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{r.sede}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{horaRango(r.hora, r.duracion)}</td>
                              <td>Cancha {r.cancha}</td>
                              <td>{r.nombre}</td>
                              <td>{r.email}</td>
                              <td>${(r.precio || 30000).toLocaleString('es-AR')}</td>
                              <td><EstadoBadge reserva={r} /></td>
                              <td style={{ textAlign: 'center' }}>
                                <button onClick={() => iniciarEdicion(r)} style={{ padding: '5px 10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' }}>✏️ Editar</button>
                                <button onClick={() => cancelarReserva(r.id)} style={{ padding: '5px 10px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>🗑️ Cancelar</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            );
          };

          return (
            <>
              {/* Upcoming */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'rgba(255,255,255,0.9)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
                  Próximas reservas
                </h3>
                <ReservasTable lista={proximas} accentColor="#3b2f6e" emptyText="Sin reservas próximas." />
              </div>

              {/* Completed */}
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                  Reservas completadas
                </h3>
                <ReservasTable lista={completadas} accentColor="#4a4a6a" emptyText="Sin reservas completadas." />
              </div>
            </>
          );
        })()}
      </div>}

    </div>
  );
}