import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import UserHeader from '../components/UserHeader';

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

export default function TorneosPublicos({ onLogout }) {
  const navigate = useNavigate();
  const [torneos, setTorneos] = useState([]);
  const [sedesMap, setSedesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [{ data: torneosData, error: torneosError }, { data: sedesData, error: sedesError }] =
      await Promise.all([
        supabase.from('torneos').select('*').order('fecha_inicio', { ascending: true }),
        supabase.from('sedes').select('id,nombre,ciudad,pais'),
      ]);

    if (torneosError) {
      console.error('Error cargando torneos:', torneosError);
      setTorneos([]);
    } else {
      setTorneos(torneosData || []);
    }

    if (sedesError) {
      console.error('Error cargando sedes:', sedesError);
      setSedesMap({});
    } else {
      const map = {};
      (sedesData || []).forEach((s) => {
        map[String(s.id)] = s;
      });
      setSedesMap(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        padding: '12px',
      }}
    >
      <UserHeader onLogout={onLogout} title="Torneos" showBack />

      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '14px 16px',
            marginBottom: '14px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>
            Torneos disponibles
          </div>
          <div style={{ fontSize: '14px', opacity: 0.92 }}>
            Elegí un torneo para ver sus detalles, inscribirte y formar o unirte a un equipo.
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'white', textAlign: 'center' }}>Cargando...</p>
        ) : torneos.length === 0 ? (
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '18px',
              color: '#4b5563',
              textAlign: 'center',
              boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
            }}
          >
            No hay torneos disponibles.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '14px',
            }}
          >
            {torneos.map((t) => {
              const sede = sedesMap[String(t.sede_id)];
              const badge = estadoStyle[t.estado] || {
                label: t.estado || 'Sin estado',
                bg: '#e5e7eb',
                color: '#374151',
              };

              return (
                <div
                  key={t.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '14px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '10px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontWeight: 700,
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {sede?.nombre || 'Club / sede'}
                      </div>

                      <h3 style={{ margin: 0, color: '#111827', lineHeight: 1.2 }}>
                        {t.nombre || 'Sin nombre'}
                      </h3>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: badge.bg,
                        color: badge.color,
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: '10px',
                      color: '#4b5563',
                      fontSize: '14px',
                      lineHeight: 1.5,
                    }}
                  >
                    <div>📍 {sede?.nombre || 'Sede no encontrada'}</div>
                    <div>🗺️ {sede?.ciudad || '—'}{sede?.pais ? `, ${sede.pais}` : ''}</div>
                    <div>📅 {formatFecha(t.fecha_inicio)}</div>
                    <div>🏆 {t.tipo_torneo || '—'}</div>
                    <div>⭐ {t.nivel_torneo || '—'}</div>
                  </div>

                  <button
                    onClick={() => navigate(`/torneo/${t.id}/vista`)}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Ver torneo
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}