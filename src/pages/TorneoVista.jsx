import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/TorneoVista.css';

// "2026-02-26" → "26 Feb 2026"
function formatFecha(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

const ADMIN_EMAILS = ['padbolinternacional@gmail.com', 'admin@padbol.com', 'sm@padbol.com', 'juanpablo@padbol.com'];

export default function TorneoVista() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const [torneo, setTorneo] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPartido, setSelectedPartido] = useState(null);
  const [resultado, setResultado] = useState({ set1: '', set2: '', set3: '' });
  const [iniciando, setIniciando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const currentEmail = (JSON.parse(localStorage.getItem('currentCliente') || '{}')?.email || '').trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(currentEmail);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [torneoRes, equiposRes, partidosRes] = await Promise.all([
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}`),
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/equipos`),
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/partidos`)
        ]);

        if (!torneoRes.ok || !equiposRes.ok || !partidosRes.ok) {
          throw new Error('Error al cargar datos');
        }

        const torneoData = await torneoRes.json();
        const equiposData = await equiposRes.json();
        const partidosData = await partidosRes.json();

        setTorneo(torneoData);
        setEquipos(equiposData);
        setPartidos(partidosData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [torneoId]);

  const calcularEstadisticas = () => {
    const stats = {};
    equipos.forEach(eq => {
      stats[eq.id] = {
        jj: 0,
        g: 0,
        p: 0,
        pts: 0,
        sg: 0,
        sp: 0,
        gg: 0,
        gp: 0
      };
    });

    partidos.forEach(partido => {
      if (partido.estado === 'finalizado' && partido.resultado) {
        const resultado = JSON.parse(partido.resultado);
        const sets = [resultado.set1, resultado.set2, resultado.set3].filter(s => s);

        let setsGanados_A = 0, setsGanados_B = 0;
        let gamesGanados_A = 0, gamesGanados_B = 0;

        sets.forEach(set => {
          const [a, b] = set.split('-').map(Number);
          gamesGanados_A += a;
          gamesGanados_B += b;
          if (a > b) setsGanados_A++;
          else setsGanados_B++;
        });

        const eqA = stats[partido.equipo_a_id];
        const eqB = stats[partido.equipo_b_id];

        eqA.jj++;
        eqB.jj++;
        eqA.sg += setsGanados_A;
        eqA.sp += setsGanados_B;
        eqA.gg += gamesGanados_A;
        eqA.gp += gamesGanados_B;
        eqB.sg += setsGanados_B;
        eqB.sp += setsGanados_A;
        eqB.gg += gamesGanados_B;
        eqB.gp += gamesGanados_A;

        if (setsGanados_A > setsGanados_B) {
          eqA.g++;
          eqB.p++;
          eqA.pts += 3;
        } else {
          eqB.g++;
          eqA.p++;
          eqB.pts += 3;
        }
      }
    });

    return stats;
  };

  const stats = calcularEstadisticas();

  const tablaPosiciones = equipos.map(eq => ({
    id: eq.id,
    nombre: eq.nombre,
    jugadores: eq.jugadores || [],
    puntos_ranking: eq.puntos_ranking || 0,
    jj: stats[eq.id].jj,
    g: stats[eq.id].g,
    p: stats[eq.id].p,
    pts: stats[eq.id].pts,
    sg: stats[eq.id].sg,
    sp: stats[eq.id].sp,
    gg: stats[eq.id].gg,
    gp: stats[eq.id].gp,
    djuegos: (stats[eq.id].gg - stats[eq.id].gp) || 0,
    dif: (stats[eq.id].sg - stats[eq.id].sp) || 0
  })).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if ((b.sg - b.sp) !== (a.sg - a.sp)) return (b.sg - b.sp) - (a.sg - a.sp);
    if ((b.gg - b.gp) !== (a.gg - a.gp)) return (b.gg - b.gp) - (a.gg - a.gp);
    return 0;
  });

  const abrirModal = (partido) => {
    if (partido.estado === 'finalizado') {
      alert('Este partido ya está finalizado');
      return;
    }
    setSelectedPartido(partido);
    setResultado({ set1: '', set2: '', set3: '' });
    setShowModal(true);
  };

  const guardarResultado = async () => {
    if (!selectedPartido) return;

    const sets = [resultado.set1, resultado.set2, resultado.set3].filter(s => s.trim());
    if (sets.length < 2) {
      alert('Mínimo 2 sets requeridos');
      return;
    }

    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/partidos/${selectedPartido.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'finalizado',
          resultado: JSON.stringify(resultado)
        })
      });

      if (res.ok) {
        setPartidos(partidos.map(p => 
          p.id === selectedPartido.id 
            ? { ...p, estado: 'finalizado', resultado: JSON.stringify(resultado) }
            : p
        ));
        setShowModal(false);
        setSelectedPartido(null);
      }
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const iniciarTorneo = async () => {
    if (!window.confirm('¿Iniciar el torneo? El estado cambiará a "en curso".')) return;
    setIniciando(true);
    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'en_curso' })
      });
      if (res.ok) {
        setTorneo(prev => ({ ...prev, estado: 'en_curso' }));
      } else {
        alert('Error al iniciar el torneo');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIniciando(false);
    }
  };

  const finalizarTorneo = async () => {
    if (!window.confirm('¿Finalizar el torneo? Se calcularán las posiciones finales y se asignarán los puntos de ranking.')) return;
    setFinalizando(true);
    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setEquipos(prev => prev.map(eq => {
          const found = (data.clasificacion || []).find(c => c.equipo_id === eq.id);
          return found ? { ...eq, puntos_ranking: found.puntos } : eq;
        }));
        setTorneo(prev => ({ ...prev, estado: 'finalizado' }));
      } else {
        alert(data.error || 'Error al finalizar el torneo');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setFinalizando(false);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!torneo) return <div className="error">Torneo no encontrado</div>;

  if (torneo.estado === 'finalizado') {
    const top3   = tablaPosiciones.slice(0, 3);
    const rest   = tablaPosiciones.slice(3, 10);
    const first  = top3[0];
    const second = top3[1];
    const third  = top3[2];

    const PodiumCard = ({ eq, medal }) => (
      <div className="podium-card">
        <div className="podium-medal">{medal}</div>
        <div className="podium-team-name">{eq.nombre}</div>
        {eq.jugadores.length > 0 && (
          <div className="podium-players">{eq.jugadores.map(j => j.nombre).join(' · ')}</div>
        )}
        <div className="podium-points">{eq.puntos_ranking} <span>pts</span></div>
      </div>
    );

    return (
      <div className="torneo-vista-container">
        <button className="btn-atras" onClick={() => navigate('/admin?tab=torneos')}>← Atrás</button>

        <div className="finalizado-header">
          <div className="finalizado-trophy">🏆</div>
          <h1 className="finalizado-titulo">¡Torneo Finalizado!</h1>
          <p className="finalizado-nombre">{torneo.nombre}</p>
          <p className="finalizado-info">
            {torneo.nivel_torneo} • {torneo.tipo_torneo} • {formatFecha(torneo.fecha_inicio)} a {formatFecha(torneo.fecha_fin)}
          </p>
        </div>

        <div className="podium-wrapper">
          {second && (
            <div className="podium-slot">
              <PodiumCard eq={second} medal="🥈" />
              <div className="podium-block podium-block-2">2</div>
            </div>
          )}
          {first && (
            <div className="podium-slot">
              <PodiumCard eq={first} medal="🥇" />
              <div className="podium-block podium-block-1">1</div>
            </div>
          )}
          {third && (
            <div className="podium-slot">
              <PodiumCard eq={third} medal="🥉" />
              <div className="podium-block podium-block-3">3</div>
            </div>
          )}
        </div>

        {rest.length > 0 && (
          <div className="clasificacion-resto">
            <h3>Clasificación final</h3>
            {rest.map((eq, idx) => (
              <div key={eq.id} className="clasificacion-item">
                <span className="clasificacion-pos">{idx + 4}</span>
                <div className="clasificacion-info">
                  <span className="clasificacion-nombre">{eq.nombre}</span>
                  {eq.jugadores.length > 0 && (
                    <span className="clasificacion-players">{eq.jugadores.map(j => j.nombre).join(' · ')}</span>
                  )}
                </div>
                <span className="clasificacion-pts">{eq.puntos_ranking} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="torneo-vista-container">
      <button className="btn-atras" onClick={() => navigate('/admin?tab=torneos')}>← Atrás</button>

      <div className="torneo-header">
        <h1>🏆 {torneo.nombre}</h1>
        <p>{torneo.nivel_torneo} • {torneo.tipo_torneo} • {formatFecha(torneo.fecha_inicio)} a {formatFecha(torneo.fecha_fin)}</p>
        {isAdmin && !['en_curso', 'finalizado'].includes((torneo.estado || '').toLowerCase()) && (
          <div className="torneo-acciones">
            <button className="btn-agregar-jugadores" onClick={() => navigate(`/torneo/${torneoId}/jugadores`)}>
              👥 Agregar jugadores
            </button>
            <button className="btn-iniciar-torneo" onClick={iniciarTorneo} disabled={iniciando}>
              {iniciando ? 'Iniciando...' : '🚀 Iniciar torneo'}
            </button>
          </div>
        )}
        {isAdmin && torneo.estado === 'en_curso' && partidos.length > 0 && partidos.every(p => p.estado === 'finalizado') && (
          <div className="torneo-acciones">
            <button className="btn-finalizar-torneo" onClick={finalizarTorneo} disabled={finalizando}>
              {finalizando ? 'Finalizando...' : '🏆 Finalizar torneo'}
            </button>
          </div>
        )}
      </div>

      <div className="contenedor-dos-columnas">
        <div className="tabla-posiciones-box">
          <h2>📊 Tabla de Posiciones</h2>
          <table className="tabla-posiciones">
            <thead>
              <tr>
                <th>#</th>
                <th>EQUIPO</th>
                <th>JJ</th>
                <th>G</th>
                <th>P</th>
                <th>PTS</th>
                <th>SG</th>
                <th>SP</th>
                <th>GG</th>
                <th>GP</th>
                <th>DJUEGOS</th>
                <th>DIF</th>
              </tr>
            </thead>
            <tbody>
              {tablaPosiciones.map((eq, idx) => (
                <tr key={eq.id}>
                  <td>{idx + 1}</td>
                  <td className="equipo-nombre">
                    {eq.nombre}
                    {eq.jugadores.length > 0 && (
                      <span className="jugadores-nombres">
                        {eq.jugadores.map(j => j.nombre).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td>{eq.jj}</td>
                  <td>{eq.g}</td>
                  <td>{eq.p}</td>
                  <td className="pts">{eq.pts}</td>
                  <td>{eq.sg}</td>
                  <td>{eq.sp}</td>
                  <td>{eq.gg}</td>
                  <td>{eq.gp}</td>
                  <td className={eq.djuegos > 0 ? 'positivo' : eq.djuegos < 0 ? 'negativo' : ''}>
                    {eq.djuegos > 0 ? '+' : ''}{eq.djuegos}
                  </td>
                  <td className={eq.dif > 0 ? 'positivo' : eq.dif < 0 ? 'negativo' : ''}>
                    {eq.dif > 0 ? '+' : ''}{eq.dif}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="partidos-box">
          <h2>📋 Partidos</h2>
          {partidos.length === 0 ? (
            <p className="sin-partidos">Sin partidos aún</p>
          ) : (
            <div className="lista-partidos">
              {partidos.map(partido => {
                const eqA = equipos.find(e => e.id === partido.equipo_a_id);
                const eqB = equipos.find(e => e.id === partido.equipo_b_id);
                return (
                  <div key={partido.id} className="partido-item" onClick={() => abrirModal(partido)}>
                    <div className="partido-content">
                      <span className="equipo-a">
                        {eqA?.nombre || 'Equipo A'}
                        {eqA?.jugadores?.length > 0 && (
                          <span className="jugadores-nombres">
                            {eqA.jugadores.map(j => j.nombre).join(' · ')}
                          </span>
                        )}
                      </span>
                      <span className="vs">vs</span>
                      <span className="equipo-b">
                        {eqB?.nombre || 'Equipo B'}
                        {eqB?.jugadores?.length > 0 && (
                          <span className="jugadores-nombres">
                            {eqB.jugadores.map(j => j.nombre).join(' · ')}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className={`estado ${partido.estado}`}>
                      {partido.estado === 'finalizado' ? '✅ Finalizado' : '⏳ Pendiente'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Cargar Resultado</h3>
            {selectedPartido && (() => {
              const mA = equipos.find(e => e.id === selectedPartido.equipo_a_id);
              const mB = equipos.find(e => e.id === selectedPartido.equipo_b_id);
              const nombresA = mA?.jugadores?.map(j => j.nombre).join(', ');
              const nombresB = mB?.jugadores?.map(j => j.nombre).join(', ');
              return (
                <p>
                  {mA?.nombre}{nombresA && <span className="modal-jugadores"> ({nombresA})</span>}
                  {' vs '}
                  {mB?.nombre}{nombresB && <span className="modal-jugadores"> ({nombresB})</span>}
                </p>
              );
            })()}
            
            <div className="form-sets">
              <div className="input-group">
                <label>Set 1 (ej: 6-4)</label>
                <input
                  type="text"
                  placeholder="6-4"
                  value={resultado.set1}
                  onChange={e => setResultado({ ...resultado, set1: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Set 2 (ej: 7-5)</label>
                <input
                  type="text"
                  placeholder="7-5"
                  value={resultado.set2}
                  onChange={e => setResultado({ ...resultado, set2: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Set 3 (opcional)</label>
                <input
                  type="text"
                  placeholder="6-2"
                  value={resultado.set3}
                  onChange={e => setResultado({ ...resultado, set3: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-guardar" onClick={guardarResultado}>Guardar</button>
              <button className="btn-cancelar" onClick={() => setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}