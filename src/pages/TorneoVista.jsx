import React, { useEffect, useMemo, useState } from 'react';
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

function formatFecha(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${y}`;
}

const estadoStyle = {
  abierto: { label: 'Abierto', bg: '#dcfce7', color: '#166534' },
  en_curso: { label: 'En curso', bg: '#fef3c7', color: '#92400e' },
  finalizado: { label: 'Finalizado', bg: '#fee2e2', color: '#991b1b' },
  cancelado: { label: 'Cancelado', bg: '#e5e7eb', color: '#374151' },
  planificacion: { label: 'Planificación', bg: '#e5e7eb', color: '#374151' },
};

function normalizePlayer(p) {
  if (!p) return null;
  if (typeof p === 'string') return { nombre: p, email: '' };
  return {
    nombre: p.nombre || p.email || 'Jugador',
    email: p.email || '',
  };
}

export default function TorneoVista({ onLogout, apiBaseUrl = 'https://padbol-backend.onrender.com' }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const currentCliente = getCurrentCliente();
  const roleData = getRoleData();
  const isAdmin = ['super_admin', 'admin_nacional', 'admin_club'].includes(roleData?.rol);

  const [torneo, setTorneo] = useState(null);
  const [sede, setSede] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);

      const torneoId = Number(id);
      if (!torneoId) return;

      const { data: torneoData } = await supabase.from('torneos').select('*').eq('id', torneoId).maybeSingle();
      setTorneo(torneoData);

      if (torneoData?.sede_id) {
        const { data: sedeData } = await supabase.from('sedes').select('*').eq('id', torneoData.sede_id).maybeSingle();
        setSede(sedeData);
      }

      const { data: jugadoresData } = await supabase
        .from('jugadores_torneo')
        .select('*')
        .eq('torneo_id', torneoId);

      setJugadores(jugadoresData || []);

      try {
        const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}/equipos`);
        const data = await res.json();
        setEquipos(data || []);
      } catch {
        setEquipos([]);
      }

      setLoading(false);
    };

    cargarDatos();
  }, [id]);

  const ranking = [...equipos].sort((a, b) => (b.puntos_ranking || 0) - (a.puntos_ranking || 0));

  if (loading) return <div style={{ color: 'white' }}>Cargando...</div>;

  const badge = estadoStyle[torneo?.estado] || estadoStyle.planificacion;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '12px' }}>
      <UserHeader onLogout={onLogout} title="Torneo" homePath="/" />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '20px' }}>
          <h2>{torneo?.nombre}</h2>
          <span style={{ background: badge.bg, color: badge.color, padding: '6px 12px', borderRadius: '999px' }}>
            {badge.label}
          </span>
        </div>

        {/* INFO */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
          <p>📍 {sede?.nombre}</p>
          <p>📅 {formatFecha(torneo?.fecha_inicio)}</p>
        </div>

        {/* RESULTADOS */}
        {torneo?.estado === 'finalizado' && (
          <div style={{ background: 'white', marginTop: '20px', padding: '20px', borderRadius: '12px' }}>
            <h3>🏆 Resultados</h3>

            {ranking.map((eq, i) => (
              <div key={i}>
                {i + 1}° {eq.nombre} — {eq.puntos_ranking} pts
              </div>
            ))}
          </div>
        )}

        {/* BOTÓN VOLVER */}
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => navigate('/torneos')}
            style={{
              padding: '10px 16px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.16)',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Volver
          </button>
        </div>

      </div>
    </div>
  );
}