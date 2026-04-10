import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/FormEquipos.css';

const API = 'https://padbol-backend.onrender.com';

export default function FormEquipos() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const [torneo, setTorneo] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [equipos, setEquipos] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`equipos_${torneoId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedJugadores, setSelectedJugadores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const torneoRes = await fetch(`${API}/api/torneos/${torneoId}`);
        const torneoData = await torneoRes.json();
        setTorneo(torneoData);

        const jugadoresRes = await fetch(`${API}/api/torneos/${torneoId}/jugadores`);
        const jugadoresData = await jugadoresRes.json();
        setJugadores(jugadoresData || []);

        setLoading(false);
      } catch (err) {
        setError('Error al cargar datos: ' + err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [torneoId]);

  // Persist equipos to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem(`equipos_${torneoId}`, JSON.stringify(equipos));
  }, [equipos, torneoId]);

  // Build a map of jugadorId -> equipo nombre for assigned players
  const assignedMap = {};
  equipos.forEach(eq => {
    eq.jugadores.forEach(j => {
      assignedMap[j.id] = eq.nombre;
    });
  });

  const handleSelectJugador = (jugadorId) => {
    if (assignedMap[jugadorId]) return;
    setSelectedJugadores(prev => {
      const next = { ...prev };
      if (next[jugadorId]) {
        delete next[jugadorId];
      } else {
        next[jugadorId] = true;
      }
      return next;
    });
  };

  const crearEquipo = () => {
    const selected = Object.keys(selectedJugadores).map(id =>
      jugadores.find(j => j.id === parseInt(id))
    );

    if (selected.length === 0) {
      setError('Selecciona al menos 1 jugador');
      return;
    }

    if (selected.length > 4) {
      setError('Máximo 4 jugadores por equipo');
      return;
    }

    const nuevoEquipo = {
      id: equipos.length + 1,
      nombre: `Equipo ${equipos.length + 1}`,
      jugadores: selected,
    };

    setEquipos([...equipos, nuevoEquipo]);
    setSelectedJugadores({});
    setError('');
    setMensaje(`✅ Equipo creado con ${selected.length} jugadores`);
    setTimeout(() => setMensaje(''), 2000);
  };

  const eliminarEquipo = (equipoId) => {
    setEquipos(equipos.filter(e => e.id !== equipoId));
  };

  const renombrarEquipo = (equipoId, nuevoNombre) => {
    setEquipos(equipos.map(e =>
      e.id === equipoId ? { ...e, nombre: nuevoNombre } : e
    ));
  };

  const iniciarTorneo = async () => {
    if (equipos.length === 0) {
      setError('Crea al menos un equipo');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // 1. Save all teams
      for (const equipo of equipos) {
        const equipoData = {
          nombre: equipo.nombre,
          sede_id: torneo?.sede_id || null,
          jugadores: equipo.jugadores.map(j => ({ id: j.id, nombre: j.nombre, email: j.email })),
        };

        const response = await fetch(`${API}/api/torneos/${torneoId}/equipos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(equipoData),
        });

        if (!response.ok) {
          throw new Error('Error al guardar equipo');
        }
      }

      // 2. Generate matches based on tournament format
      const genRes = await fetch(`${API}/api/torneos/${torneoId}/generar-partidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!genRes.ok) {
        const genErr = await genRes.json();
        throw new Error(genErr.error || 'Error al generar partidos');
      }

      const genData = await genRes.json();

      sessionStorage.removeItem(`equipos_${torneoId}`);
      setMensaje(`✅ Torneo iniciado — ${genData.total} partidos generados (${genData.formato})`);
      setTimeout(() => navigate('/admin'), 2000);
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>;

  const unassignedCount = jugadores.filter(j => !assignedMap[j.id]).length;

  return (
    <div className="form-equipos-container">
      <div className="form-equipos-card">
        <button className="btn-volver" onClick={() => navigate(`/torneo/${torneoId}/jugadores`)}>
          ← Volver
        </button>

        <h1>⚽ Formar Equipos</h1>
        <p className="torneo-nombre">{torneo?.nombre}</p>

        <div className="form-equipos-layout">
          <div className="seccion-jugadores">
            <h2>👥 Jugadores ({unassignedCount} disponibles)</h2>
            <div className="lista-jugadores">
              {jugadores.length === 0 ? (
                <p className="sin-datos">Sin jugadores</p>
              ) : (
                jugadores.map(jugador => {
                  const teamName = assignedMap[jugador.id];
                  const isAssigned = !!teamName;
                  return (
                    <div
                      key={jugador.id}
                      className={`jugador-item${isAssigned ? ' jugador-asignado' : ''}`}
                    >
                      <input
                        type="checkbox"
                        id={`jugador-${jugador.id}`}
                        checked={!!selectedJugadores[jugador.id]}
                        onChange={() => handleSelectJugador(jugador.id)}
                        disabled={isAssigned}
                      />
                      <label htmlFor={`jugador-${jugador.id}`}>
                        <strong>{jugador.nombre}</strong>
                        <span>{jugador.email}</span>
                        {isAssigned && <span className="equipo-badge">{teamName}</span>}
                      </label>
                    </div>
                  );
                })
              )}
            </div>

            {Object.keys(selectedJugadores).length > 0 && (
              <button className="btn-crear-equipo" onClick={crearEquipo}>
                ✅ Crear Equipo ({Object.keys(selectedJugadores).length}/4)
              </button>
            )}
          </div>

          <div className="seccion-equipos">
            <h2>🏆 Equipos ({equipos.length})</h2>
            <div className="lista-equipos">
              {equipos.length === 0 ? (
                <p className="sin-datos">Sin equipos</p>
              ) : (
                equipos.map(equipo => (
                  <div key={equipo.id} className="equipo-item">
                    <div className="equipo-header">
                      <input
                        type="text"
                        className="equipo-nombre-input"
                        value={equipo.nombre}
                        onChange={e => renombrarEquipo(equipo.id, e.target.value)}
                        placeholder="Nombre del equipo"
                      />
                      <button
                        className="btn-eliminar"
                        onClick={() => eliminarEquipo(equipo.id)}
                      >
                        🗑️
                      </button>
                    </div>
                    <ul className="equipo-jugadores">
                      {equipo.jugadores.map(jugador => (
                        <li key={jugador.id}>{jugador.nombre}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {mensaje && <div className="success-message">{mensaje}</div>}

        <button
          className="btn-iniciar"
          onClick={iniciarTorneo}
          disabled={loading || equipos.length === 0}
        >
          {loading ? 'Iniciando...' : '🚀 Iniciar Torneo'}
        </button>
      </div>
    </div>
  );
}
