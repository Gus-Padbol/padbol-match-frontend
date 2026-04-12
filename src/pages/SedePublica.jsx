import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function formatHorario(apertura, cierre) {
  if (!apertura && !cierre) return null;
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  return apertura || cierre;
}

export default function SedePublica({ currentCliente }) {
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const [sede, setSede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sedeId) return;
    console.log('[SedePublica] loading sedeId:', sedeId);
    setLoading(true);
    setError('');
    supabase
      .from('sedes')
      .select('*')
      .eq('id', parseInt(sedeId, 10))
      .maybeSingle()
      .then(({ data, error: err }) => {
        console.log('[SedePublica] data:', data, 'error:', err);
        if (err) {
          setError(`Error al cargar sede: ${err.message}`);
        } else if (!data) {
          setError('No se encontró la sede.');
        } else {
          setSede(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[SedePublica] catch error:', err);
        setError('Error inesperado al cargar la sede.');
        setLoading(false);
      });
  }, [sedeId]);

  const btnBase = {
    padding: '10px 20px', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: 700, fontSize: '13px',
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'white', fontSize: '16px' }}>Cargando sede...</p>
    </div>
  );

  if (error || !sede) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '20px' }}>
      <p style={{ color: 'white', fontSize: '16px', textAlign: 'center' }}>{error || 'Sede no encontrada.'}</p>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>sedeId: {sedeId}</p>
      <button onClick={() => navigate(-1)} style={{ ...btnBase, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)' }}>← Volver</button>
    </div>
  );

  const licenciaActiva = sede.licencia_activa === true && sede.numero_licencia;
  const fotos = Array.isArray(sede.fotos_urls) ? sede.fotos_urls : [];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', paddingBottom: '60px' }}>

      {/* Top bar */}
      <div style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ height: '32px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} style={{ ...btnBase, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}>← Volver</button>
          {currentCliente && (
            <button onClick={() => navigate('/perfil')} style={{ ...btnBase, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }}>👤 Mi Perfil</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '28px 16px 0' }}>

        {/* Logo */}
        {sede.logo_url && (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img
              src={sede.logo_url}
              alt={`Logo ${sede.nombre}`}
              style={{ width: '120px', height: '120px', objectFit: 'contain', borderRadius: '20px', background: 'white', padding: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
            />
          </div>
        )}

        {/* Name + license badge */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 800, margin: '0 0 12px', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            {sede.nombre}
          </h1>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
            background: licenciaActiva ? 'rgba(220,252,231,0.95)' : 'rgba(254,226,226,0.95)',
            color: licenciaActiva ? '#15803d' : '#dc2626',
          }}>
            {licenciaActiva ? '✅ Licencia PADBOL Activa' : '⛔ No habilitado'}
          </span>
        </div>

        {/* Info card */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(sede.direccion || sede.ciudad || sede.pais) && (
              <InfoRow icon="📍" text={[sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', ')} />
            )}
            {formatHorario(sede.horario_apertura, sede.horario_cierre) && (
              <InfoRow icon="⏰" text={`Abierto ${formatHorario(sede.horario_apertura, sede.horario_cierre)}`} />
            )}
            {sede.telefono && (
              <InfoRow icon="📞" text={sede.telefono} />
            )}
            {sede.email_contacto && (
              <InfoRow icon="✉️" text={sede.email_contacto} />
            )}
            {sede.precio_turno && (
              <InfoRow icon="💰" text={`${Number(sede.precio_turno).toLocaleString('es-AR')} ${sede.moneda || 'ARS'} por turno (90 min)`} />
            )}
          </div>
        </div>

        {/* Court photos */}
        {fotos.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>📸 Las canchas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {fotos.map((url, i) => (
                <div key={url} style={{ borderRadius: '12px', overflow: 'hidden', aspectRatio: '4/3', background: '#e5e7eb' }}>
                  <img src={url} alt={`Cancha ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reserve button */}
        <button
          onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
          style={{
            width: '100%', padding: '16px',
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            color: 'white', border: 'none', borderRadius: '14px',
            cursor: 'pointer', fontWeight: 800, fontSize: '17px',
            boxShadow: '0 4px 16px rgba(22,163,74,0.45)',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(22,163,74,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.45)'; }}
        >
          🎾 Reservar Cancha
        </button>

      </div>
    </div>
  );
}

function InfoRow({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#374151' }}>
      <span style={{ flexShrink: 0, fontSize: '16px', width: '22px', textAlign: 'center', marginTop: '1px' }}>{icon}</span>
      <span style={{ lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}
