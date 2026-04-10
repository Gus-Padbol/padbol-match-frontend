import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

export default function MiPerfil({ currentCliente }) {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    lateralidad: 'Diestro',
    nivel: 'Principiante',
    pais: '',
    ciudad: '',
    club: '',
    fecha_nacimiento: '',
  });

  useEffect(() => {
    if (!currentCliente?.email) {
      navigate('/');
      return;
    }
    fetchPerfil();
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
        nivel: data.nivel || 'Principiante',
        pais: data.pais || '',
        ciudad: data.ciudad || '',
        club: data.club || '',
        fecha_nacimiento: data.fecha_nacimiento || '',
      });
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formData.pais) {
      setErrorMsg('Seleccioná tu país');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (perfil) {
      const { error } = await supabase
        .from('jugadores_perfil')
        .update({
          lateralidad: formData.lateralidad,
          nivel: formData.nivel,
          pais: formData.pais,
          ciudad: formData.ciudad || null,
          club: formData.club || null,
          fecha_nacimiento: formData.fecha_nacimiento || null,
        })
        .eq('email', currentCliente.email);

      if (error) {
        setErrorMsg('Error al guardar: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('jugadores_perfil')
        .insert([{
          email: currentCliente.email,
          nombre: currentCliente.nombre,
          whatsapp: currentCliente.whatsapp || null,
          lateralidad: formData.lateralidad,
          nivel: formData.nivel,
          pais: formData.pais,
          ciudad: formData.ciudad || null,
          club: formData.club || null,
          fecha_nacimiento: formData.fecha_nacimiento || null,
        }]);

      if (error) {
        setErrorMsg('Error al guardar: ' + error.message);
        setSaving(false);
        return;
      }
    }

    await fetchPerfil();
    setSaving(false);
    setSuccessMsg('✅ Perfil guardado');
    setEditando(false);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    marginBottom: '14px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    boxSizing: 'border-box',
    fontSize: '14px',
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Cargando perfil...</div>;
  }

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', fontFamily: 'Arial' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '8px 16px', background: '#999', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          ← Volver
        </button>
        <h2 style={{ margin: 0, color: '#d32f2f' }}>Mi Perfil</h2>
      </div>

      <div style={{ background: '#f5f5f5', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        {/* Header with user info */}
        <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
          {currentCliente.foto ? (
            <img
              src={currentCliente.foto}
              alt="Foto"
              style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'contain', border: '2px solid #d32f2f', marginBottom: '10px' }}
            />
          ) : (
            <div style={{ width: '90px', height: '90px', borderRadius: '12px', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '36px' }}>
              👤
            </div>
          )}
          <h3 style={{ margin: '0 0 4px', color: '#222' }}>{currentCliente.nombre}</h3>
          <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{currentCliente.email}</p>
          {currentCliente.whatsapp && (
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>📱 {currentCliente.whatsapp}</p>
          )}
        </div>

        {!perfil && !editando ? (
          <div style={{ textAlign: 'center' }}>
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
            <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
              <Row label="Lateralidad" value={perfil.lateralidad} />
              <Row label="Nivel" value={perfil.nivel} />
              <Row label="País" value={perfil.pais} />
              {perfil.ciudad && <Row label="Ciudad" value={perfil.ciudad} />}
              {perfil.club && <Row label="Club" value={perfil.club} />}
              {perfil.fecha_nacimiento && <Row label="Fecha de nacimiento" value={perfil.fecha_nacimiento} />}
            </div>
            {successMsg && <p style={{ color: '#4caf50', textAlign: 'center', fontWeight: 'bold' }}>{successMsg}</p>}
            <button
              onClick={() => setEditando(true)}
              style={{ width: '100%', padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✏️ Editar perfil
            </button>
          </>
        ) : (
          <form onSubmit={handleGuardar}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Lateralidad</label>
            <select name="lateralidad" value={formData.lateralidad} onChange={handleChange} style={inputStyle}>
              <option value="Diestro">🤜 Diestro</option>
              <option value="Zurdo">🤛 Zurdo</option>
            </select>

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Nivel de juego</label>
            <select name="nivel" value={formData.nivel} onChange={handleChange} style={inputStyle}>
              <option value="Principiante">🟢 Principiante</option>
              <option value="Intermedio">🟡 Intermedio</option>
              <option value="Avanzado">🟠 Avanzado</option>
              <option value="Profesional">🔴 Profesional</option>
            </select>

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>País *</label>
            <select name="pais" value={formData.pais} onChange={handleChange} style={inputStyle} required>
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

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Ciudad</label>
            <input
              type="text"
              name="ciudad"
              placeholder="Ej: Buenos Aires"
              value={formData.ciudad}
              onChange={handleChange}
              style={inputStyle}
            />

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Club</label>
            <input
              type="text"
              name="club"
              placeholder="Ej: Club Padbol Palermo"
              value={formData.club}
              onChange={handleChange}
              style={inputStyle}
            />

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>Fecha de nacimiento</label>
            <input
              type="date"
              name="fecha_nacimiento"
              value={formData.fecha_nacimiento}
              onChange={handleChange}
              style={inputStyle}
            />

            {errorMsg && <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={saving}
                style={{ flex: 1, padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Guardando...' : '✅ Guardar'}
              </button>
              <button
                type="button"
                onClick={() => { setEditando(false); setErrorMsg(''); }}
                style={{ flex: 1, padding: '11px', background: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
      <span style={{ color: '#666', fontSize: '14px' }}>{label}</span>
      <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{value}</span>
    </div>
  );
}
