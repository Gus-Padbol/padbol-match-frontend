import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import './ContentWorkspace.css';

const SPORTS = [
  ['padbol', 'Padbol'],
  ['padel', 'Pádel'],
  ['pickleball', 'Pickleball'],
  ['tenis', 'Tenis'],
];

const CARDS = [
  ['reservar', 'Reservar cancha'],
  ['buscar_partido', 'Buscar partido'],
  ['torneos', 'Torneos'],
  ['rankings', 'Rankings'],
  ['armar_partido', 'Crear partido'],
];

const EMPTY_AD = {
  deporte: 'padbol',
  slot_key: 'app_general',
  titulo: '',
  media_type: 'image',
  imagen_url: '',
  video_url: '',
  poster_url: '',
  destino_url: '',
  activo: true,
};

function blankCard(deporte, cardKey) {
  return {
    deporte,
    card_key: cardKey,
    titulo: '',
    subtitulo: '',
    imagen_url: '',
    media_type: 'image',
    video_url: '',
    poster_url: '',
  };
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function ContentWorkspace({ apiBaseUrl, onLogout }) {
  const [items, setItems] = useState([]);
  const [ads, setAds] = useState([]);
  const [sport, setSport] = useState('padbol');
  const [cardKey, setCardKey] = useState('reservar');
  const [form, setForm] = useState(blankCard('padbol', 'reservar'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [message, setMessage] = useState('');
  const [adSport, setAdSport] = useState('padbol');
  const [adForm, setAdForm] = useState(EMPTY_AD);
  const [adSaving, setAdSaving] = useState(false);
  const [adMessage, setAdMessage] = useState('');

  const selected = useMemo(
    () => items.find(
      (item) => item.deporte === sport && item.card_key === cardKey,
    ) ?? blankCard(sport, cardKey),
    [items, sport, cardKey],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [response, adsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/admin/content/hub`, { headers }),
        fetch(`${apiBaseUrl}/api/admin/content/ads`, { headers }),
      ]);
      const [data, adsData] = await Promise.all([
        response.json(),
        adsResponse.json(),
      ]);
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cargar el contenido');
      }
      if (!adsResponse.ok) {
        throw new Error(adsData.error || 'No se pudo cargar la publicidad');
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setAds(Array.isArray(adsData.items) ? adsData.items : []);
    } catch (error) {
      setMessage(`No se pudo cargar el contenido: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setForm({ ...selected });
  }, [selected]);

  useEffect(() => {
    const current = ads.find(
      (item) => item.deporte === adSport && item.slot_key === 'app_general',
    );
    setAdForm({
      ...EMPTY_AD,
      deporte: adSport,
      ...(current ?? {}),
    });
  }, [ads, adSport]);

  function chooseCard(nextSport, nextCardKey) {
    setSport(nextSport);
    setCardKey(nextCardKey);
    setMessage('');
  }

  async function uploadMedia(file) {
    const token = await getToken();
    const body = new FormData();
    body.append('file', file);
    const response = await fetch(`${apiBaseUrl}/api/admin/content/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo subir el archivo');
    }
    return data;
  }

  async function uploadCardFile(event, target) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(`card-${target}`);
    setMessage('');
    try {
      const data = await uploadMedia(file);
      const key = target === 'video'
        ? 'video_url'
        : target === 'poster'
          ? 'poster_url'
          : 'imagen_url';
      setForm((current) => ({
        ...current,
        media_type: target === 'video' ? 'video' : current.media_type,
        [key]: data.url,
      }));
    } catch (error) {
      setMessage(`No se pudo subir el archivo: ${error.message}`);
    } finally {
      setUploading('');
      event.target.value = '';
    }
  }

  async function uploadAdFile(event, target) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(`ad-${target}`);
    setAdMessage('');
    try {
      const data = await uploadMedia(file);
      const key = target === 'video'
        ? 'video_url'
        : target === 'poster'
          ? 'poster_url'
          : 'imagen_url';
      setAdForm((current) => ({
        ...current,
        media_type: target === 'video' ? 'video' : current.media_type,
        [key]: data.url,
      }));
    } catch (error) {
      setAdMessage(`No se pudo subir el archivo: ${error.message}`);
    } finally {
      setUploading('');
      event.target.value = '';
    }
  }

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const token = await getToken();
      const response = await fetch(
        `${apiBaseUrl}/api/admin/content/hub/${sport}/${cardKey}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar');
      setItems((current) => [
        ...current.filter(
          (item) => !(item.deporte === sport && item.card_key === cardKey),
        ),
        data.item,
      ]);
      setMessage('Cambios publicados en la app.');
    } catch (error) {
      setMessage(`No se pudo guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveAd() {
    setAdSaving(true);
    setAdMessage('');
    try {
      const token = await getToken();
      const response = await fetch(
        `${apiBaseUrl}/api/admin/content/ads/${adSport}/app_general`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(adForm),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar');
      setAds((current) => [
        ...current.filter(
          (item) => !(item.deporte === adSport && item.slot_key === 'app_general'),
        ),
        data.item,
      ]);
      setAdMessage('Publicidad publicada.');
    } catch (error) {
      setAdMessage(`No se pudo guardar: ${error.message}`);
    } finally {
      setAdSaving(false);
    }
  }

  return (
    <main className="content-workspace">
      <header className="content-workspace__header">
        <div>
          <p className="content-workspace__eyebrow">PADBOL MATCH · CONTENIDO</p>
          <h1>Contenido de la app</h1>
          <p>Editá imágenes, textos, videos y promociones sin tocar el código.</p>
        </div>
        <button
          type="button"
          className="content-workspace__logout"
          onClick={onLogout}
        >
          Cerrar sesión
        </button>
      </header>

      <section className="content-workspace__notice">
        Los cambios se publican para el deporte elegido. Podés subir un archivo
        desde tu computadora o pegar una URL ya publicada.
      </section>

      <section className="content-workspace__layout">
        <aside className="content-workspace__picker">
          <h2>Deporte</h2>
          <div className="content-workspace__sports">
            {SPORTS.map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => chooseCard(key, cardKey)}
                className={sport === key ? 'is-active' : ''}
              >
                {label}
              </button>
            ))}
          </div>

          <h2>Espacio</h2>
          <div className="content-workspace__cards">
            {CARDS.map(([key, label]) => {
              const hasContent = items.some(
                (item) => item.deporte === sport
                  && item.card_key === key
                  && (item.imagen_url || item.video_url),
              );
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => chooseCard(sport, key)}
                  className={cardKey === key ? 'is-active' : ''}
                >
                  <span>{label}</span>
                  <small>{hasContent ? 'Listo' : 'Pendiente'}</small>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="content-workspace__editor">
          <div className="content-workspace__editor-heading">
            <div>
              <p>EDITANDO</p>
              <h2>
                {CARDS.find(([key]) => key === cardKey)?.[1]}
                {' · '}
                {SPORTS.find(([key]) => key === sport)?.[1]}
              </h2>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading}>
              Actualizar
            </button>
          </div>

          {loading ? (
            <p>Cargando…</p>
          ) : (
            <>
              <label>
                Título opcional
                <input
                  value={form.titulo || ''}
                  maxLength="140"
                  onChange={(event) => setForm({ ...form, titulo: event.target.value })}
                />
              </label>
              <label>
                Subtítulo opcional
                <input
                  value={form.subtitulo || ''}
                  maxLength="280"
                  onChange={(event) => setForm({ ...form, subtitulo: event.target.value })}
                />
              </label>
              <fieldset>
                <legend>Formato</legend>
                <label className="content-workspace__radio">
                  <input
                    type="radio"
                    checked={form.media_type !== 'video'}
                    onChange={() => setForm({
                      ...form,
                      media_type: 'image',
                      video_url: '',
                      poster_url: '',
                    })}
                  />
                  Imagen
                </label>
                <label className="content-workspace__radio">
                  <input
                    type="radio"
                    checked={form.media_type === 'video'}
                    onChange={() => setForm({ ...form, media_type: 'video' })}
                  />
                  Video
                </label>
              </fieldset>

              {form.media_type === 'video' ? (
                <>
                  <label>
                    Video (máximo 50 MB)
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      onChange={(event) => void uploadCardFile(event, 'video')}
                    />
                    {uploading === 'card-video' ? 'Subiendo…' : null}
                    <input
                      value={form.video_url || ''}
                      placeholder="o pegá la URL del video"
                      onChange={(event) => setForm({
                        ...form,
                        video_url: event.target.value,
                      })}
                    />
                  </label>
                  <label>
                    Portada del video
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void uploadCardFile(event, 'poster')}
                    />
                    {uploading === 'card-poster' ? 'Subiendo…' : null}
                    <input
                      value={form.poster_url || ''}
                      placeholder="o pegá la URL de la portada"
                      onChange={(event) => setForm({
                        ...form,
                        poster_url: event.target.value,
                      })}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Imagen de la card
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void uploadCardFile(event, 'image')}
                  />
                  {uploading === 'card-image' ? 'Subiendo…' : null}
                  <input
                    value={form.imagen_url || ''}
                    placeholder="o pegá la URL de una imagen"
                    onChange={(event) => setForm({
                      ...form,
                      imagen_url: event.target.value,
                    })}
                  />
                </label>
              )}

              <div className="content-workspace__preview">
                <p>VISTA PREVIA</p>
                {form.media_type === 'video' ? (
                  <img
                    src={form.poster_url || form.imagen_url || ''}
                    alt="Portada del video"
                  />
                ) : (
                  <img src={form.imagen_url || ''} alt="Vista previa de card" />
                )}
              </div>
              <footer>
                <button
                  type="button"
                  className="content-workspace__save"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  {saving ? 'Guardando…' : 'Guardar y publicar'}
                </button>
                {message ? <p role="status">{message}</p> : null}
              </footer>
            </>
          )}
        </section>
      </section>

      <section className="content-workspace__ads">
        <p className="content-workspace__eyebrow">PROMOCIONES</p>
        <h2>Publicidad general por deporte</h2>
        <p>Este anuncio alimenta los espacios dinámicos actuales de la app.</p>
        <div className="content-workspace__sports">
          {SPORTS.map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => setAdSport(key)}
              className={adSport === key ? 'is-active' : ''}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Nombre interno
          <input
            value={adForm.titulo || ''}
            onChange={(event) => setAdForm({
              ...adForm,
              titulo: event.target.value,
            })}
          />
        </label>
        <label>
          Imagen o portada
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void uploadAdFile(event, 'image')}
          />
          {uploading === 'ad-image' ? 'Subiendo…' : null}
          <input
            value={adForm.imagen_url || ''}
            placeholder="o pegá una URL pública"
            onChange={(event) => setAdForm({
              ...adForm,
              imagen_url: event.target.value,
            })}
          />
        </label>
        <label>
          Video opcional
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={(event) => void uploadAdFile(event, 'video')}
          />
          {uploading === 'ad-video' ? 'Subiendo…' : null}
          <input
            value={adForm.video_url || ''}
            placeholder="o pegá una URL pública"
            onChange={(event) => setAdForm({
              ...adForm,
              media_type: event.target.value ? 'video' : 'image',
              video_url: event.target.value,
            })}
          />
        </label>
        <label>
          Destino opcional
          <input
            value={adForm.destino_url || ''}
            placeholder="https://…"
            onChange={(event) => setAdForm({
              ...adForm,
              destino_url: event.target.value,
            })}
          />
        </label>
        <label className="content-workspace__radio">
          <input
            type="checkbox"
            checked={adForm.activo !== false}
            onChange={(event) => setAdForm({
              ...adForm,
              activo: event.target.checked,
            })}
          />
          Publicidad activa
        </label>
        <footer>
          <button
            type="button"
            className="content-workspace__save"
            onClick={() => void saveAd()}
            disabled={adSaving}
          >
            {adSaving ? 'Guardando…' : 'Guardar publicidad'}
          </button>
          {adMessage ? <p role="status">{adMessage}</p> : null}
        </footer>
      </section>
    </main>
  );
}
