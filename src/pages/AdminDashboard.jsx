import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

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

  useEffect(() => {
    fetchData();
  }, [apiBaseUrl]);

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

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🏆 PADBOL MATCH - ADMIN</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>

      {mensajeExito && (
        <div style={{
          background: '#4caf50',
          color: 'white',
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          {mensajeExito}
        </div>
      )}

      <div className="dashboard-grid">
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
      </div>

      <div className="section">
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
      </div>

      <div className="section">
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
      </div>
    </div>
  );
}