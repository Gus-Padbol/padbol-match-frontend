import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PagoExitoso() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const externalRef  = params.get('external_reference');
  const paymentId    = params.get('payment_id');
  const status       = params.get('status');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px',
        padding: '48px 36px', maxWidth: '440px', width: '100%',
        textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#065f46', marginBottom: '8px' }}>
          ¡Reserva confirmada y pagada!
        </h1>
        <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          Tu pago fue procesado exitosamente. Recibirás la confirmación por WhatsApp.
        </p>

        {(externalRef || paymentId) && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: '10px', padding: '14px 18px',
            marginBottom: '24px', textAlign: 'left',
          }}>
            {externalRef && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#166534' }}><strong>Reserva #:</strong> {externalRef}</p>}
            {paymentId   && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#166534' }}><strong>Pago #:</strong> {paymentId}</p>}
            {status      && <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}><strong>Estado:</strong> {status}</p>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Ir al inicio
          </button>
          <button
            onClick={() => navigate('/reservar')}
            style={{
              padding: '11px', background: 'transparent',
              color: '#047857', border: '1.5px solid #059669',
              borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            🎾 Hacer otra reserva
          </button>
        </div>
      </div>
    </div>
  );
}
