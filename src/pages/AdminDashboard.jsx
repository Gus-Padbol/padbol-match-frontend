import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

export default function AdminDashboard({ handleLogout, apiBaseUrl }) {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [equiposPorTorneo, setEquiposPorTorneo] = useState({});
  const [ingresos, setIngresos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar reservas
        const resRes = await fetch(`${apiBaseUrl}/api/reservas`);
        const resData = await resRes.json();
        setReservas(resData);
        const suma = resData.reduce((total, item) => total + (item.precio || 30000), 0);
        setIngresos(suma);

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

    fetchData();
  }, []);

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>;

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🏆 PADBOL MATCH - ADMIN</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="card ingresos">
          <h2>Ingresos Totales</h2>
          <p className="amount">${ingresos.toLocaleString('es-AR')}</p>
          <p className="currency">ARS</p>
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
        <h2>📋 Torneos Creados</h2>
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
            </tr>
          </thead>
          <tbody>
            {reservas.length > 0 ? (
              reservas.map(r => (
                <tr key={r.id}>
                  <td>{r.sede}</td>
                  <td>{r.fecha}</td>
                  <td>{r.hora}</td>
                  <td>Cancha {r.cancha}</td>
                  <td>{r.nombre}</td>
                  <td>{r.email}</td>
                  <td>${(r.precio || 30000).toLocaleString('es-AR')}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7">Sin reservas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}