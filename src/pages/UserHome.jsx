import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserHeader from '../components/UserHeader';

export default function UserHome({ currentCliente, onLogout }) {
  const navigate = useNavigate();

  const botones = [
    {
      label: 'Reservar',
      icon: '🎾',
      action: () => navigate('/reservar'),
    },
    {
      label: 'Torneos',
      icon: '🏆',
      action: () => navigate('/torneos'),
    },
    {
      label: 'Ranking',
      icon: '🥇',
      action: () => navigate('/rankings'),
    },
    {
      label: 'Perfil',
      icon: '👤',
      action: () => navigate('/perfil'),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        padding: '12px',
      }}
    >
      <UserHeader onLogout={onLogout} title="Inicio" homePath="/" />

      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>
            Hola{currentCliente?.nombre ? `, ${currentCliente.nombre}` : ''}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.92 }}>
            Elegí qué querés hacer.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          {botones.map(({ label, icon, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: 'white',
                border: 'none',
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                cursor: 'pointer',
                padding: '20px',
              }}
            >
              <span style={{ fontSize: '2rem' }}>{icon}</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}