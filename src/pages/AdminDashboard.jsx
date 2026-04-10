import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import { supabase } from '../supabaseClient';

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

export default function AdminDashboard({ handleLogout, apiBaseUrl = 'https://padbol-backend.onrender.com' }) {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [equiposPorTorneo, setEquiposPorTorneo] = useState({});
  const [ingresos, setIngresos] = useState({ ARS: 0, USD: 0, EUR: 0 });
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');
  const [activeTab, setActiveTab] = useState('resumen');

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

  const fetchData = async () => {
    try {
      // Cargar reservas
      const resRes = await fetch(`${apiBaseUrl}/api/reservas`);
      const resData = await resRes.json();
      setReservas(resData);
      const totales = { ARS: 0, USD: 0, EUR: 0 };
      resData.forEach(item => {
        const moneda = item.moneda || 'ARS';
        if (moneda in totales) totales[moneda] += item.precio || 0;
        else totales.ARS += item.precio || 0;
      });
      setIngresos(totales);

      // Cargar torneos
      const tornRes = await fetch(`${apiBaseUrl}/api/torneos`);
      const tornData = await tornRes.json();
      setTorneos(tornData);

      // Cargar equipos por cada torneo
      const equiposMap = {};
      for (const torneo of tornData) {
        const equipRes = await fetch(`${apiBaseUrl}/api/torneos/${torneo.id}/equipos`);
        const equipData = await equipRes.json();
        equiposMap[torneo.id] = equipData;
      }
      setEquiposPorTorneo(equiposMap);

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
        <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.3)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
  <h2>📋 Torneos Creados</h2>
  <button
    onClick={() => navigate('/torneo/crear')}
    style={{ padding: '10px 20px', background: '#e53935', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
  >
    + Nuevo Torneo
  </button>
</div>
        {torneos.length === 0 ? (
          <p>Sin torneos</p>
        ) : (
          torneos.map(torneo => (
            <div key={torneo.id} className="torneo-card">
              <h3 
                style={{ cursor: 'pointer', color: '#667eea', textDecoration: 'underline' }} 
                onClick={() => navigate(`/torneo/${torneo.id}/vista`)}
              >
                {torneo.nombre}
              </h3>
              <p><strong>Nivel:</strong> {torneo.nivel_torneo}</p>
              <p><strong>Formato:</strong> {torneo.tipo_torneo}</p>
              <p><strong>Estado:</strong> {torneo.estado}</p>
              <p><strong>Fechas:</strong> {torneo.fecha_inicio} a {torneo.fecha_fin}</p>
              
              <h4>Equipos ({equiposPorTorneo[torneo.id]?.length || 0}):</h4>
              {equiposPorTorneo[torneo.id]?.length > 0 ? (
                <div className="equipos-list">
                  {equiposPorTorneo[torneo.id].map(equipo => (
                    <div key={equipo.id} className="equipo-item">
                      <p><strong>{equipo.nombre}</strong></p>
                      <p>Jugadores: {equipo.jugadores?.length || 0}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999' }}>Sin equipos</p>
              )}
            </div>
          ))
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
        <h2>💰 Reservas Confirmadas</h2>
        <table className="reservas-table">
          <thead>
            <tr>
              <th>Sede</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Cancha</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Precio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservas.length > 0 ? (
              reservas.map(r => (
                <tr key={r.id}>
                  {editandoId === r.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editFormData.sede || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, sede: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={editFormData.fecha || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, fecha: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={editFormData.hora || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, hora: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.cancha || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, cancha: parseInt(e.target.value) })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editFormData.nombre || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="email"
                          value={editFormData.email || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.precio || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, precio: parseInt(e.target.value) })}
                          style={{ width: '100%', padding: '5px' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => guardarEdicion(r.id)}
                          style={{
                            padding: '5px 10px',
                            background: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            marginRight: '5px',
                          }}
                        >
                          ✅ Guardar
                        </button>
                        <button
                          onClick={cancelarEdicion}
                          style={{
                            padding: '5px 10px',
                            background: '#999',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          ✕ Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{r.sede}</td>
                      <td>{r.fecha}</td>
                      <td>{r.hora}</td>
                      <td>Cancha {r.cancha}</td>
                      <td>{r.nombre}</td>
                      <td>{r.email}</td>
                      <td>${(r.precio || 30000).toLocaleString('es-AR')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => iniciarEdicion(r)}
                          style={{
                            padding: '5px 10px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            marginRight: '5px',
                          }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => cancelarReserva(r.id)}
                          style={{
                            padding: '5px 10px',
                            background: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️ Cancelar
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr><td colSpan="8">Sin reservas</td></tr>
            )}
          </tbody>
        </table>
      </div>}

    </div>
  );
}