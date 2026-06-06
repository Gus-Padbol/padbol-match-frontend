import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import UserHeader from '../components/UserHeader';

function getCurrentCliente() {
  try {
    const raw = localStorage.getItem('currentCliente');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getRoleData() {
  try {
    const raw = localStorage.getItem('user_role_data');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizePlayer(p) {
  if (!p) return null;
  if (typeof p === 'string') {
    return { nombre: p, email: '' };
  }
  return {
    nombre: p.nombre || p.email || 'Jugador',
    email: p.email || '',
  };
}

function samePerson(a, b) {
  if (!a || !b) return false;
  if (a.email && b.email) return a.email === b.email;
  return a.nombre === b.nombre;
}

export default function EquipoVista({ onLogout }) {
  const navigate = useNavigate();
  const { id, equipoId } = useParams();

  const currentCliente = getCurrentCliente();
  const roleData = getRoleData();
  const isAdmin = ['super_admin', 'admin_nacional', 'admin_club'].includes(roleData?.rol);

  const [equipo, setEquipo] = useState(null);
  const [torneo, setTorneo] = useState(null);
  const [players, setPlayers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargarEquipo = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('equipos')
      .select('*')
      .eq('id', Number(equipoId))
      .maybeSingle();

    if (error) {
      console.error(error);
      setEquipo(null);
      setTorneo(null);
      setPlayers([]);
      setRequests([]);
      setLoading(false);
      return;
    }

    setEquipo(data || null);

    if (data?.torneo_id) {
      const { data: torneoData, error: torneoError } = await supabase
        .from('torneos')
        .select('*')
        .eq('id', Number(data.torneo_id))
        .maybeSingle();

      if (torneoError) {
        console.error(torneoError);
        setTorneo(null);
      } else {
        setTorneo(torneoData || null);
      }
    } else {
      setTorneo(null);
    }

    const jugadores = Array.isArray(data?.jugadores)
      ? data.jugadores.map(normalizePlayer).filter(Boolean)
      : typeof data?.jugadores === 'string' && data.jugadores.trim()
      ? data.jugadores
          .split(' + ')
          .map((n) => ({ nombre: n.trim(), email: '' }))
          .filter((p) => p.nombre)
      : [];

    const solicitudes = Array.isArray(data?.solicitudes)
      ? data.solicitudes.map(normalizePlayer).filter(Boolean)
      : [];

    setPlayers(jugadores);
    setRequests(solicitudes);
    setLoading(false);
  };

  useEffect(() => {
    if (equipoId) cargarEquipo();
  }, [equipoId]);

  const soyCreador =
    !!currentCliente?.email &&
    !!equipo?.creador_email &&
    currentCliente.email === equipo.creador_email;

  const aceptarSolicitud = async (solicitud) => {
    if (!equipo) return;

    const cupo = Number(equipo.cupo_maximo || 2);
    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    const nuevosJugadores = [...players, solicitud];
    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, solicitud));

    const { error } = await supabase
      .from('equipos')
      .update({
        jugadores: nuevosJugadores,
        solicitudes: nuevasSolicitudes,
      })
      .eq('id', Number(equipoId));

    if (error) {
      console.error(error);
      alert('Error al aceptar');
      return;
    }

    cargarEquipo();
  };

  const rechazarSolicitud = async (solicitud) => {
    if (!equipo) return;

    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, solicitud));

    const { error } = await supabase
      .from('equipos')
      .update({ solicitudes: nuevasSolicitudes })
      .eq('id', Number(equipoId));

    if (error) {
      console.error(error);
      alert('Error al rechazar');
      return;
    }

    cargarEquipo();
  };

  const homePath = torneo?.sede_id ? `/sede/${torneo.sede_id}` : '/';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '12px' }}>
        <UserHeader onLogout={onLogout} title="Equipo" homePath={homePath} />
        <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px' }}>
          Cargando equipo...
        </div>
      </div>
    );
  }

  if (!equipo) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '12px' }}>
        <UserHeader onLogout={onLogout} title="Equipo" homePath={homePath} />
        <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '24px' }}>
          <p>No se encontró el equipo.</p>
          <button
            onClick={() => navigate(`/torneo/${id}/equipos`)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#999',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '12px' }}>
      <UserHeader onLogout={onLogout} title="Equipo" homePath={homePath} />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            marginBottom: '18px'
          }}
        >
          <h2 style={{ marginTop: 0 }}>🏆 {equipo.nombre}</h2>

          <div style={{ color: '#666', marginBottom: '16px' }}>
            {players.length}/{Number(equipo.cupo_maximo || 2)} jugadores
          </div>

          <h3>Jugadores del equipo</h3>

          {players.length === 0 ? (
            <div style={{ color: '#666' }}>Todavía no hay jugadores</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {players.map((p, idx) => (
                <div
                  key={`${p.email || p.nombre}-${idx}`}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#f3f4f6'
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                  {p.email ? (
                    <div style={{ fontSize: '13px', color: '#666' }}>{p.email}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {(soyCreador || isAdmin) && (
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
              marginBottom: '18px'
            }}
          >
            <h3 style={{ marginTop: 0 }}>Solicitudes pendientes</h3>

            {requests.length === 0 ? (
              <div style={{ color: '#666' }}>No hay solicitudes pendientes.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {requests.map((sol, idx) => (
                  <div
                    key={`${sol.email || sol.nombre}-${idx}`}
                    style={{
                      background: '#f9fafb',
                      borderRadius: '10px',
                      padding: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '8px' }}>{sol.nombre}</div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => aceptarSolicitud(sol)}
                        style={{
                          padding: '8px 12px',
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        Aceptar
                      </button>

                      <button
                        onClick={() => rechazarSolicitud(sol)}
                        style={{
                          padding: '8px 12px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => navigate(`/torneo/${id}/equipos`)}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#999',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          ← Volver a equipos
        </button>
      </div>
    </div>
  );
}