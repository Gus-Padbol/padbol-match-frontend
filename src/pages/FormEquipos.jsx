import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/FormEquipos.css';

export default function FormEquipos() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const [torneo, setTorneo] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [selectedJugadores, setSelectedJugadores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const torneoRes = await fetch(`http://localhost:3001/api/torneos/${torneoId}`);
        const torneoData = await torneoRes.json();
        setTorneo(torneoData);

        const jugadoresRes = await fetch(`http://localhost:3001/api/torneos/${torneoId}/jugadores`);
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

  const handleSelectJugador = (jugadorId) => {
    setSelectedJugadores(prev => {
      const newSelected = { ...prev };
      if (newSelected[jugadorId]) {
        delete newSelected[jugadorId];
      } else {
        newSelected[jugadorId] = true;
      }
      return newSelected;
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

  const iniciarTorneo = async () => {
    if (equipos.length === 0) {
      setError('Crea al menos un equipo');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Guardar cada equipo en la BD
      for (const equipo of equipos) {
        const equipoData = {
          nombre: equipo.nombre,
          sede_id: torneo?.sede_id || null,
          jugadores: equipo.jugadores.map(j => ({ id: j.id, nombre: j.nombre, email: j.email })),
        };

        const response = await fetch(`http://localhost:3001/api/torneos/${torneoId}/equipos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(equipoData),
        });

        if (!response.ok) {
          throw new Error('Error al guardar equipo');
        }
      }

      setMensaje('✅ Torneo iniciado con éxito');
      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>;

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
            <h2>👥 Jugadores ({jugadores.length})</h2>
            <div className="lista-jugadores">
              {jugadores.length === 0 ? (
                <p className="sin-datos">Sin jugadores</p>
              ) : (
                jugadores.map(jugador => (
                  <div key={jugador.id} className="jugador-item">
                    <input
                      type="checkbox"
                      id={`jugador-${jugador.id}`}
                      checked={!!selectedJugadores[jugador.id]}
                      onChange={() => handleSelectJugador(jugador.id)}
                    />
                    <label htmlFor={`jugador-${jugador.id}`}>
                      <strong>{jugador.nombre}</strong>
                      <span>{jugador.email}</span>
                    </label>
                  </div>
                ))
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
                      <h3>{equipo.nombre}</h3>
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