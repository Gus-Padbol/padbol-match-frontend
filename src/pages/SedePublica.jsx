import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function formatHorario(apertura, cierre) {
  if (!apertura && !cierre) return null;
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  return apertura || cierre;
}

/* ─── Photo Carousel ──────────────────────────────────────────────────── */
function Carousel({ fotos }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  const go = (next) => {
    setIdx((prev) => (prev + next + fotos.length) % fotos.length);
  };

  useEffect(() => {
    if (fotos.length <= 1) return;
    timerRef.current = setInterval(() => go(1), 4000);
    return () => clearInterval(timerRef.current);
  }, [fotos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = (next) => {
    clearInterval(timerRef.current);
    go(next);
    timerRef.current = setInterval(() => go(1), 4000);
  };

  if (!fotos.length) return null;

  return (
    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#111', marginBottom: '24px' }}>
      {/* Main image */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: fotos.length >= 2 ? 'repeat(2, 1fr)' : '1fr',
        gap: '3px',
        maxHeight: '340px',
        overflow: 'hidden',
      }}>
        {/* On mobile show 1, on wider show 2 side-by-side */}
        {[fotos[idx], fotos[(idx + 1) % fotos.length]]
          .slice(0, fotos.length >= 2 ? 2 : 1)
          .map((url, i) => (
            <div key={`${url}-${i}`} style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
              <img
                src={url}
                alt={`Cancha ${idx + i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.3s' }}
              />
            </div>
          ))}
      </div>

      {/* Left arrow */}
      {fotos.length > 1 && (
        <button
          onClick={() => restart(-1)}
          style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none',
            cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Anterior"
        >‹</button>
      )}

      {/* Right arrow */}
      {fotos.length > 1 && (
        <button
          onClick={() => restart(1)}
          style={{
            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none',
            cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Siguiente"
        >›</button>
      )}

      {/* Dots */}
      {fotos.length > 1 && (
        <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
          {fotos.map((_, i) => (
            <button
              key={i}
              onClick={() => { clearInterval(timerRef.current); setIdx(i); timerRef.current = setInterval(() => go(1), 4000); }}
              style={{
                width: i === idx ? '20px' : '8px', height: '8px',
                borderRadius: '4px', border: 'none', cursor: 'pointer',
                background: i === idx ? 'white' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.25s',
                padding: 0,
              }}
              aria-label={`Foto ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Info row ────────────────────────────────────────────────────────── */
function InfoRow({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px', color: '#374151' }}>
      <span style={{ flexShrink: 0, fontSize: '18px', width: '24px', textAlign: 'center', marginTop: '1px' }}>{icon}</span>
      <span style={{ lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */
export default function SedePublica({ currentCliente }) {
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const [sede, setSede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[SedePublica] useEffect fired, sedeId:', sedeId);
    if (!sedeId) { setError('No se recibió un ID de sede.'); setLoading(false); return; }
    setLoading(true); setError('');
    supabase
      .from('sedes')
      .select('*')
      .eq('id', parseInt(sedeId, 10))
      .maybeSingle()
      .then(({ data, error: err }) => {
        console.log('[SedePublica] query result — data:', data, 'error:', err);
        if (err) setError(`Error al cargar sede: ${err.message}`);
        else if (!data) setError(`Sede con id ${sedeId} no encontrada.`);
        else setSede(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('[SedePublica] catch:', err);
        setError('Error inesperado: ' + (err?.message || String(err)));
        setLoading(false);
      });
  }, [sedeId]);

  const btnBack = {
    padding: '9px 18px', border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
    background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(4px)',
  };

  /* ── Shell (always visible) ── */
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>

      {/* ── Floating top nav ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <img src="/logo-padbol-match.png" alt="Padbol Match" style={{ height: '30px', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate(-1)} style={btnBack}>← Volver</button>
          {currentCliente && (
            <button onClick={() => navigate('/perfil')} style={btnBack}>👤 Mi Perfil</button>
          )}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'white', fontSize: '18px', fontWeight: 600 }}>Cargando sede...</p>
        </div>
      )}

      {/* ── Error / not found ── */}
      {!loading && (error || !sede) && (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px' }}>
          <p style={{ color: 'white', fontSize: '16px', fontWeight: 600, textAlign: 'center' }}>{error || 'Sede no encontrada.'}</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>sedeId: {sedeId ?? '(undefined)'}</p>
        </div>
      )}

      {/* ── Sede loaded ── */}
      {!loading && !error && sede && (() => {
        console.log('[SedePublica] rendering sede:', sede);
        const licenciaActiva = sede.licencia_activa === true && sede.numero_licencia;
        const fotos = Array.isArray(sede.fotos_urls) ? sede.fotos_urls : [];
        const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);

        return (
          <>
            {/* ── HERO ── */}
            <div style={{
              position: 'relative',
              minHeight: '340px',
              background: sede.logo_url
                ? `url(${sede.logo_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
              paddingBottom: '36px',
              overflow: 'hidden',
            }}>
              {/* Dark overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.72) 100%)',
              }} />

              {/* Logo circle */}
              {sede.logo_url && (
                <div style={{ position: 'relative', zIndex: 2, marginBottom: '16px' }}>
                  <img
                    src={sede.logo_url}
                    alt={`Logo ${sede.nombre}`}
                    style={{
                      width: '96px', height: '96px', objectFit: 'contain',
                      borderRadius: '20px', background: 'white', padding: '10px',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
                    }}
                  />
                </div>
              )}

              {/* Club name */}
              <h1 style={{
                position: 'relative', zIndex: 2,
                color: 'white', fontSize: 'clamp(1.6rem, 5vw, 2.4rem)',
                fontWeight: 900, margin: '0 0 12px', textAlign: 'center',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)', padding: '0 20px',
                lineHeight: 1.2,
              }}>
                {sede.nombre || '(sin nombre)'}
              </h1>

              {/* License badge */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 700,
                  background: licenciaActiva ? 'rgba(220,252,231,0.95)' : 'rgba(254,226,226,0.95)',
                  color: licenciaActiva ? '#15803d' : '#dc2626',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}>
                  {licenciaActiva ? '✅ Licencia PADBOL Activa' : '⛔ No habilitado'}
                </span>
              </div>
            </div>

            {/* ── BODY ── */}
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px 80px' }}>

              {/* Info card */}
              <div style={{ background: 'white', borderRadius: '18px', padding: '24px 28px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: '20px' }}>

                {/* Descripción */}
                {sede.descripcion && (
                  <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7, margin: '0 0 20px', borderBottom: '1px solid #f0f0f0', paddingBottom: '20px' }}>
                    {sede.descripcion}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(sede.direccion || sede.ciudad || sede.pais) && (
                    <InfoRow icon="📍" text={[sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', ')} />
                  )}
                  {horario && (
                    <InfoRow icon="⏰" text={`Abierto ${horario}`} />
                  )}
                  {sede.telefono && (
                    <InfoRow icon="📞" text={sede.telefono} />
                  )}
                  {sede.email_contacto && (
                    <InfoRow icon="✉️" text={sede.email_contacto} />
                  )}
                  {sede.precio_turno && (
                    <InfoRow
                      icon="💰"
                      text={`${Number(sede.precio_turno).toLocaleString('es-AR')} ${sede.moneda || 'ARS'} por turno (90 min)`}
                    />
                  )}
                  {!sede.descripcion && !sede.direccion && !sede.ciudad && !sede.pais && !sede.telefono && !sede.email_contacto && (
                    <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Sin información de contacto cargada.</p>
                  )}
                </div>
              </div>

              {/* Photo carousel */}
              {fotos.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: '#1e1b4b', fontSize: '15px', fontWeight: 700, marginBottom: '12px', paddingLeft: '2px' }}>📸 Las canchas</h3>
                  <Carousel fotos={fotos} />
                </div>
              )}

              {/* Reserve button */}
              <button
                onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
                style={{
                  width: '100%', padding: '18px 24px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  cursor: 'pointer', fontWeight: 800, fontSize: '17px',
                  boxShadow: '0 4px 18px rgba(185,28,28,0.45)',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                  letterSpacing: '0.2px',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(185,28,28,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 18px rgba(185,28,28,0.45)'; }}
              >
                🎾 Reservar Cancha en {sede.nombre || 'esta sede'} →
              </button>

            </div>
          </>
        );
      })()}
    </div>
  );
}
