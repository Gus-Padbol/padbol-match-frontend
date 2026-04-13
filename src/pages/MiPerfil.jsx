import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import UserHeader from '../components/UserHeader';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

const CATEGORIA_COLOR = {
  Principiante: '#78909c',
  '5ta':        '#43a047',
  '4ta':        '#039be5',
  '3ra':        '#8e24aa',
  '2da':        '#e53935',
  '1ra':        '#f57c00',
  Elite:        '#212121',
};

export default function MiPerfil({ currentCliente, onLogout }) {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const fotoInputRef = useRef(null);
  const [cancelando, setCancelando] = useState(null); // reservaId being cancelled
  const [creditTotal, setCreditTotal] = useState(0);
  const [creditItems, setCreditItems] = useState([]);

  const [formData, setFormData] = useState({
    lateralidad: 'Diestro',
    nivel: '5ta',
    pais: '',
    ciudad: '',

    fecha_nacimiento: '',
    sede_id: '',
    numero_fipa: '',
    es_federado: false,
  });

  useEffect(() => {
    if (!currentCliente?.email) {
      navigate('/');
      return;
    }
    fetchPerfil();
    fetchSedes();
    fetchReservas();
    fetchCreditos();
  }, [currentCliente]);

  const fetchPerfil = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('*')
      .eq('email', currentCliente.email)
      .single();

    if (!error && data) {
      setPerfil(data);
      setFormData({
        lateralidad: data.lateralidad || 'Diestro',
        nivel: data.nivel || '5ta',
        pais: data.pais || '',
        ciudad: data.ciudad || '',

        fecha_nacimiento: data.fecha_nacimiento || '',
        sede_id: data.sede_id ? String(data.sede_id) : '',
        numero_fipa: data.numero_fipa || '',
        es_federado: data.es_federado || false,
      });
    }
    setLoading(false);
  };

  const fetchSedes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sedes`);
      if (res.ok) setSedes(await res.json() || []);
    } catch {
      // sedes optional — fail silently
    }
  };

  const fetchReservas = async () => {
    try {
      const { data } = await supabase
        .from('reservas')
        .select('id, sede, fecha, hora, cancha, estado, precio, moneda')
        .eq('email', currentCliente.email)
        .order('fecha', { ascending: false })
        .limit(20);
      setReservas(data || []);
    } catch {
      // fail silently
    }
  };

  const fetchCreditos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/creditos/${encodeURIComponent(currentCliente.email)}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreditTotal(data.total || 0);
      setCreditItems(data.creditos || []);
    } catch {
      // fail silently — credits are informational
    }
  };

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview immediately
    setFotoPreview(URL.createObjectURL(file));
    setFotoUploading(true);
    setErrorMsg('');

    try {
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const fotoUrl = `https://vpldffhsxhgnmitiikof.supabase.co/storage/v1/object/public/avatars/${fileName}`;

      // Save URL to jugadores_perfil (upsert so it works even before full profile is saved)
      const { error: dbError } = perfil
        ? await supabase.from('jugadores_perfil').update({ foto_url: fotoUrl }).eq('email', currentCliente.email)
        : await supabase.from('jugadores_perfil').insert([{
            email: currentCliente.email,
            nombre: currentCliente.nombre,
            foto_url: fotoUrl,
          }]);

      if (dbError) throw dbError;

      await fetchPerfil();
    } catch (err) {
      setErrorMsg('Error al subir foto: ' + err.message);
      setFotoPreview(null);
    } finally {
      setFotoUploading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formData.pais) { setErrorMsg('Seleccioná tu país'); return; }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      lateralidad: formData.lateralidad,
      nivel: formData.nivel,
      pendiente_validacion: true,
      pais: formData.pais,
      ciudad: formData.ciudad || null,

      fecha_nacimiento: formData.fecha_nacimiento || null,
      sede_id: formData.sede_id ? parseInt(formData.sede_id) : null,
      numero_fipa: formData.numero_fipa || null,
      es_federado: formData.es_federado,
    };

    const { error } = perfil
      ? await supabase.from('jugadores_perfil').update(payload).eq('email', currentCliente.email)
      : await supabase.from('jugadores_perfil').insert([{
          email: currentCliente.email,
          nombre: currentCliente.nombre,
          whatsapp: currentCliente.whatsapp || null,
          ...payload,
        }]);

    if (error) {
      setErrorMsg('Error al guardar: ' + error.message);
      setSaving(false);
      return;
    }

    await fetchPerfil();
    setSaving(false);
    setSuccessMsg('✅ Perfil guardado');
    setEditando(false);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCancelar = async (r) => {
    if (!window.confirm('¿Cancelar reserva? Si faltan más de 24hs recibirás un crédito.')) return;
    setCancelando(r.id);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/cancelar-reserva`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: r.id, email: currentCliente.email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al cancelar');
      if (data.credito) {
        alert(`✅ Reserva cancelada. Se acreditaron $${Number(data.credito.monto).toLocaleString('es-AR')} en tu cuenta (válido 30 días).`);
      } else {
        alert('✅ Reserva cancelada. La cancelación fue realizada con menos de 24hs de anticipación — no genera crédito.');
      }
      await fetchReservas();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCancelando(null);
    }
  };

  const sedeNombre = (id) => {
    const sede = sedes.find(s => String(s.id) === String(id));
    return sede ? sede.nombre : '—';
  };

  const inputStyle = {
    width: '100%', padding: '10px', marginBottom: '6px',
    border: '1px solid #ddd', borderRadius: '5px',
    boxSizing: 'border-box', fontSize: '14px', background: 'white',
  };
  const labelStyle = {
    display: 'block', fontWeight: 'bold',
    marginBottom: '5px', color: '#333', fontSize: '13px',
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Cargando perfil...</div>;
  }

  const paisParts = (perfil?.pais || '').split(' ');
  const paisFlag = paisParts[0];
  const paisNombre = paisParts.slice(1).join(' ');
  const categoriaColor = CATEGORIA_COLOR[perfil?.nivel] || '#999';

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '0', fontFamily: 'Arial' }}>

      <UserHeader onLogout={onLogout} title="Ficha de Jugador" />

      <div style={{ padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '30px 24px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', marginBottom: '16px', textAlign: 'center' }}>
        {/* Photo */}
        {(() => {
          const src = fotoPreview || perfil?.foto_url || currentCliente.foto;
          const circle = (
            <div style={{ position: 'relative', width: '150px', margin: '0 auto 14px', display: 'inline-block' }}>
              {src ? (
                <img
                  src={src}
                  alt="Foto"
                  style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #d32f2f', display: 'block' }}
                />
              ) : (
                <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', border: '3px solid #d32f2f' }}>
                  👤
                </div>
              )}
              {editando && (
                <div
                  onClick={() => !fotoUploading && fotoInputRef.current?.click()}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: fotoUploading ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: fotoUploading ? 'default' : 'pointer',
                    color: 'white', fontSize: '12px', fontWeight: 'bold', gap: '4px',
                  }}
                >
                  {fotoUploading ? (
                    <span>Subiendo...</span>
                  ) : (
                    <>
                      <span style={{ fontSize: '24px' }}>📷</span>
                      <span>Cambiar foto</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
          return circle;
        })()}
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/*"
          onChange={handleFotoChange}
          style={{ display: 'none' }}
        />

        <h3 style={{ margin: '0 0 6px', fontSize: '22px', color: '#222' }}>{currentCliente.nombre}</h3>

        {perfil?.pais && (
          <p style={{ margin: '0 0 4px', fontSize: '16px' }}>
            {paisFlag} <span style={{ color: '#555', fontSize: '14px' }}>{paisNombre}</span>
          </p>
        )}
        {perfil?.ciudad && (
          <p style={{ margin: '0 0 3px', color: '#777', fontSize: '13px' }}>📍 {perfil.ciudad}</p>
        )}
        {perfil?.sede_id && (
          <p style={{ margin: '0', color: '#777', fontSize: '13px' }}>🏟️ {sedeNombre(perfil.sede_id)}</p>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {perfil?.nivel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: categoriaColor }}>
              {perfil.nivel}
              {perfil.pendiente_validacion && (
                <span title="Pendiente de validación por administrador" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '1px 6px' }}>
                  ⏳ pendiente
                </span>
              )}
            </span>
          )}
          {perfil?.lateralidad && <Badge text={perfil.lateralidad} color="#555" />}
          {perfil?.es_federado && <Badge text="Federado" color="#388e3c" />}
          {perfil?.numero_fipa && <Badge text={`FIPA ${perfil.numero_fipa}`} color="#7b1fa2" />}
        </div>

        {successMsg && <p style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '14px', marginBottom: 0 }}>{successMsg}</p>}
      </div>

      {/* Ficha detail card */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>

        {!perfil && !editando ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p style={{ color: '#666', marginBottom: '16px' }}>Aún no tenés ficha de jugador creada.</p>
            <button
              onClick={() => setEditando(true)}
              style={{ padding: '12px 24px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🏆 Crear ficha de jugador
            </button>
          </div>

        ) : !editando ? (
          <>
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Datos del jugador</h4>
            <div style={{ display: 'grid', gap: '2px', marginBottom: '18px' }}>
              <Row label="Categoría" value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: categoriaColor }}>{perfil.nivel}</span>
                  {perfil.pendiente_validacion && (
                    <span title="Pendiente de validación" style={{ fontSize: '11px', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', borderRadius: '10px', padding: '1px 7px' }}>
                      ⏳ pendiente
                    </span>
                  )}
                </span>
              } />
              <Row label="Lateralidad" value={perfil.lateralidad} />
              {perfil.fecha_nacimiento && <Row label="Fecha de nacimiento" value={perfil.fecha_nacimiento} />}
              {perfil.sede_id && <Row label="Club al que representa" value={sedeNombre(perfil.sede_id)} />}
              {perfil.numero_fipa && <Row label="N° FIPA" value={perfil.numero_fipa} />}
              <Row label="Federado" value={perfil.es_federado ? '✅ Sí' : '❌ No'} />
            </div>
            <button
              onClick={() => setEditando(true)}
              style={{ width: '100%', padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✏️ Editar perfil
            </button>
          </>

        ) : (
          <form onSubmit={handleGuardar}>
            <h4 style={{ margin: '0 0 16px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Editar datos</h4>

            <label style={labelStyle}>Lateralidad</label>
            <select name="lateralidad" value={formData.lateralidad} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }}>
              <option value="Diestro">🤜 Diestro</option>
              <option value="Zurdo">🤛 Zurdo</option>
            </select>

            <label style={labelStyle}>Categoría</label>
            <select name="nivel" value={formData.nivel} onChange={handleChange} style={inputStyle}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '2px', marginBottom: '14px' }}>
              ⏳ La categoría será validada por un administrador
            </p>

            <label style={labelStyle}>País *</label>
            <select name="pais" value={formData.pais} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} required>
              <option value="">— Seleccionar país —</option>
              <optgroup label="Principales">
                {PAISES_TELEFONO_PRINCIPALES.map(p => (
                  <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>{p.bandera} {p.nombre}</option>
                ))}
              </optgroup>
              <optgroup label="Otros países">
                {PAISES_TELEFONO_OTROS.map(p => (
                  <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>{p.bandera} {p.nombre}</option>
                ))}
              </optgroup>
            </select>

            <label style={labelStyle}>Ciudad</label>
            <input type="text" name="ciudad" placeholder="Ej: Buenos Aires" value={formData.ciudad} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={labelStyle}>Fecha de nacimiento</label>
            <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={labelStyle}>Club al que representa</label>
            <select name="sede_id" value={formData.sede_id} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }}>
              <option value="">— Seleccionar club —</option>
              {sedes.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
            </select>

            <label style={labelStyle}>N° FIPA (número de federación)</label>
            <input type="text" name="numero_fipa" placeholder="Ej: 12345" value={formData.numero_fipa} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={{ ...labelStyle, marginBottom: '8px' }}>¿Sos federado?</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: true }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: formData.es_federado ? '#388e3c' : '#ddd', background: formData.es_federado ? '#e8f5e9' : 'white', color: formData.es_federado ? '#388e3c' : '#666', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ✅ Sí
              </button>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: false }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: !formData.es_federado ? '#d32f2f' : '#ddd', background: !formData.es_federado ? '#fff3f3' : 'white', color: !formData.es_federado ? '#d32f2f' : '#666', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ❌ No
              </button>
            </div>

            {errorMsg && <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : '✅ Guardar'}
              </button>
              <button type="button" onClick={() => { setEditando(false); setErrorMsg(''); setFotoPreview(null); }}
                style={{ flex: 1, padding: '11px', background: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Credit balance */}
      {creditTotal > 0 && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 14px', color: '#15803d', borderBottom: '1px solid #bbf7d0', paddingBottom: '8px' }}>💰 Créditos disponibles</h4>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#16a34a', marginBottom: creditItems.length ? '14px' : 0 }}>
            ${creditTotal.toLocaleString('es-AR')} <span style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>ARS</span>
          </div>
          {creditItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {creditItems.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#166534', background: 'white', borderRadius: '6px', padding: '6px 10px' }}>
                  <span>📅 {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span style={{ fontWeight: 700 }}>+${Number(c.monto).toLocaleString('es-AR')}</span>
                  <span style={{ color: '#86efac' }}>vence {new Date(c.vence_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {reservas.length > 0 && (() => {
        const sedeFav = (() => {
          const counts = {};
          reservas.forEach(r => { counts[r.sede] = (counts[r.sede] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        })();
        return (
          <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>📊 Estadísticas</h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px', background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#d32f2f' }}>{reservas.length}</div>
                <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>Reservas totales</div>
              </div>
              {sedeFav && (
                <div style={{ flex: 2, minWidth: '160px', background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.3 }}>{sedeFav}</div>
                  <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>Sede favorita</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Historial de Reservas */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>🗓️ Mis Reservas</h4>
        {reservas.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', margin: '20px 0', fontSize: '14px' }}>Aún no tenés reservas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reservas.map(r => {
              const horasHasta = (new Date(`${r.fecha}T${r.hora}:00-03:00`) - Date.now()) / (1000 * 60 * 60);
              const canCancel = horasHasta > 2 && r.estado !== 'cancelada';
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e1b4b' }}>{r.sede}</div>
                    <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>📅 {r.fecha} &nbsp;⏰ {r.hora} &nbsp;🎾 Cancha {r.cancha}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {r.precio > 0 && (
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#d32f2f' }}>
                        {Number(r.precio).toLocaleString('es-AR')} {r.moneda || 'ARS'}
                      </div>
                    )}
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                      background: r.estado === 'confirmada' ? '#dcfce7' : r.estado === 'cancelada' ? '#fee2e2' : r.estado === 'test' ? '#f3f4f6' : '#fef9c3',
                      color: r.estado === 'confirmada' ? '#16a34a' : r.estado === 'cancelada' ? '#dc2626' : r.estado === 'test' ? '#6b7280' : '#854d0e',
                    }}>{r.estado || 'reservada'}</span>
                    {canCancel && (
                      <button
                        onClick={() => handleCancelar(r)}
                        disabled={cancelando === r.id}
                        style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: '6px', background: '#fff', color: '#dc2626', cursor: 'pointer', fontWeight: 600, opacity: cancelando === r.id ? 0.6 : 1 }}
                      >
                        {cancelando === r.id ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial de Torneos */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
        <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
          🏆 Historial de Torneos
        </h4>
        <p style={{ color: '#aaa', textAlign: 'center', margin: '20px 0', fontSize: '14px' }}>
          Aún no participaste en ningún torneo registrado.
        </p>
      </div>

      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #eee' }}>
      <span style={{ color: '#777', fontSize: '13px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#333' }}>{value}</span>
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: color }}>
      {text}
    </span>
  );
}
