import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PagoFallido() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const externalRef = params.get('external_reference');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px',
        padding: '48px 36px', maxWidth: '440px', width: '100%',
        textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#991b1b', marginBottom: '8px' }}>
          El pago no se completó
        </h1>
        <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          No se realizó ningún cobro y tu reserva no fue registrada. Podés intentarlo de nuevo cuando quieras.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => navigate('/reservar')}
            style={{
              padding: '12px', background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            🔄 Intentar de nuevo
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '11px', background: 'transparent',
              color: '#b91c1c', border: '1.5px solid #dc2626',
              borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
