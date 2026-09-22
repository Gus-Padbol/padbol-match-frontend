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
  ['comunidad', 'Comunidad'],
  ['perfil', 'Perfil deportivo'],
  ['mis_partidos', 'Mis partidos'],
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

function draftFor(drafts, contentType, deporte, itemKey) {
  return drafts.find(
    (item) => item.content_type === contentType
      && item.deporte === deporte
      && item.item_key === itemKey,
  ) ?? null;
}

function statusLabel(status) {
  return {
    draft: 'Borrador',
    pending_review: 'Esperando aprobación',
    rejected: 'Con correcciones',
    approved: 'Publicado',
  }[status] || 'Sin borrador';
}

export default function ContentWorkspace({
  apiBaseUrl,
  onLogout,
  canApprove = false,
  onBack,
}) {
  const [items, setItems] = useState([]);
  const [ads, setAds] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [serverCanApprove, setServerCanApprove] = useState(false);
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
  const [previewExperience, setPreviewExperience] = useState('signature');
  const [reviewNote, setReviewNote] = useState('');

  const isApprover = canApprove || serverCanApprove;

  const selectedPublished = useMemo(
    () => items.find(
      (item) => item.deporte === sport && item.card_key === cardKey,
    ) ?? blankCard(sport, cardKey),
    [items, sport, cardKey],
  );
  const selectedDraft = useMemo(
    () => draftFor(drafts, 'hub', sport, cardKey),
    [drafts, sport, cardKey],
  );
  const selected = useMemo(
    () => (selectedDraft?.payload
      ? { ...selectedPublished, ...selectedDraft.payload }
      : selectedPublished),
    [selectedDraft, selectedPublished],
  );
  const selectedAdDraft = useMemo(
    () => draftFor(drafts, 'ad', adSport, 'app_general'),
    [drafts, adSport],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [response, adsResponse, draftsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/admin/content/hub`, { headers }),
        fetch(`${apiBaseUrl}/api/admin/content/ads`, { headers }),
        fetch(`${apiBaseUrl}/api/admin/content/drafts`, { headers }),
      ]);
      const [data, adsData, draftsData] = await Promise.all([
        response.json(),
        adsResponse.json(),
        draftsResponse.json(),
      ]);
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cargar el contenido');
      }
      if (!adsResponse.ok) {
        throw new Error(adsData.error || 'No se pudo cargar la publicidad');
      }
      if (!draftsResponse.ok) {
        throw new Error(draftsData.error || 'No se pudieron cargar los borradores');
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setAds(Array.isArray(adsData.items) ? adsData.items : []);
      setDrafts(Array.isArray(draftsData.items) ? draftsData.items : []);
      setServerCanApprove(draftsData.can_approve === true);
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
      ...(selectedAdDraft?.payload ?? {}),
    });
  }, [ads, adSport, selectedAdDraft]);

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

  async function requestDraftAction(contentType, deporte, itemKey, action, body) {
    const token = await getToken();
    const response = await fetch(
      `${apiBaseUrl}/api/admin/content/drafts/${contentType}/${deporte}/${itemKey}${action ? `/${action}` : ''}`,
      {
        method: action ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body ?? {}),
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la acción');
    if (data.draft) {
      setDrafts((current) => [
        ...current.filter(
          (item) => !(item.content_type === contentType
            && item.deporte === deporte
            && item.item_key === itemKey),
        ),
        data.draft,
      ]);
    }
    return data;
  }

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await requestDraftAction('hub', sport, cardKey, '', form);
      setMessage('Borrador guardado. Todavía no se ve en la app.');
    } catch (error) {
      setMessage(`No se pudo guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview(contentType, deporte, itemKey, setBusy, setStatusMessage) {
    setBusy(true);
    setStatusMessage('');
    try {
      await requestDraftAction(contentType, deporte, itemKey, 'submit');
      setStatusMessage('Enviado para aprobación.');
    } catch (error) {
      setStatusMessage(`No se pudo enviar: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function review(contentType, deporte, itemKey, action, setBusy, setStatusMessage) {
    setBusy(true);
    setStatusMessage('');
    try {
      await requestDraftAction(contentType, deporte, itemKey, action, { note: reviewNote });
      if (action === 'approve') await load();
      setStatusMessage(action === 'approve'
        ? 'Aprobado y publicado en la app.'
        : 'Devuelto al editor con correcciones.');
      setReviewNote('');
    } catch (error) {
      setStatusMessage(`No se pudo completar: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveAd() {
    setAdSaving(true);
    setAdMessage('');
    try {
      await requestDraftAction('ad', adSport, 'app_general', '', adForm);
      setAdMessage('Borrador de publicidad guardado.');
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
        <div className="content-workspace__header-actions">
          {onBack ? (
            <button type="button" className="content-workspace__logout" onClick={onBack}>
              Volver al panel
            </button>
          ) : null}
          <button
            type="button"
            className="content-workspace__logout"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="content-workspace__notice">
        Primero se guarda un borrador. Después se envía a revisión y sólo una
        aprobación publica el cambio en las experiencias nativas.
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
              const draft = draftFor(drafts, 'hub', sport, key);
              const published = items.some(
                (item) => item.deporte === sport && item.card_key === key,
              );
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => chooseCard(sport, key)}
                  className={cardKey === key ? 'is-active' : ''}
                >
                  <span>{label}</span>
                  <small>{draft ? statusLabel(draft.status) : (published ? 'Publicado' : 'Pendiente')}</small>
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
                <div className="content-workspace__preview-heading">
                  <p>VISTA PREVIA DE LA EXPERIENCIA</p>
                  <select
                    value={previewExperience}
                    onChange={(event) => setPreviewExperience(event.target.value)}
                  >
                    <option value="signature">Signature</option>
                    <option value="stadium">Stadium</option>
                    <option value="arena">Arena</option>
                    <option value="quantum">Quantum</option>
                  </select>
                </div>
                <div
                  className={`content-workspace__native-card content-workspace__native-card--${previewExperience}`}
                  style={{
                    backgroundImage: form.media_type === 'video' || form.imagen_url
                      ? `linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.18)), url("${form.media_type === 'video' ? (form.poster_url || form.imagen_url || '') : (form.imagen_url || '')}")`
                      : undefined,
                  }}
                >
                  <strong>
                    {form.titulo || CARDS.find(([key]) => key === cardKey)?.[1]}
                  </strong>
                  <span>{form.subtitulo || 'Texto predeterminado de la app'}</span>
                </div>
              </div>
              <div className={`content-workspace__status content-workspace__status--${selectedDraft?.status || 'published'}`}>
                Estado: {selectedDraft ? statusLabel(selectedDraft.status) : 'Contenido publicado actual'}
                {selectedDraft?.review_note ? ` · Corrección: ${selectedDraft.review_note}` : ''}
              </div>
              <footer>
                <button
                  type="button"
                  className="content-workspace__save"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  {saving ? 'Guardando…' : 'Guardar borrador'}
                </button>
                <button
                  type="button"
                  className="content-workspace__submit"
                  onClick={() => void submitForReview('hub', sport, cardKey, setSaving, setMessage)}
                  disabled={saving || !selectedDraft || selectedDraft.status === 'pending_review'}
                >
                  Enviar a aprobación
                </button>
                {message ? <p role="status">{message}</p> : null}
              </footer>
              {isApprover && selectedDraft?.status === 'pending_review' ? (
                <div className="content-workspace__review">
                  <label>
                    Observación para el editor
                    <input
                      value={reviewNote}
                      placeholder="Obligatoria sólo si devolvés el contenido"
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="content-workspace__approve"
                    disabled={saving}
                    onClick={() => void review('hub', sport, cardKey, 'approve', setSaving, setMessage)}
                  >
                    Aprobar y publicar
                  </button>
                  <button
                    type="button"
                    className="content-workspace__reject"
                    disabled={saving || !reviewNote.trim()}
                    onClick={() => void review('hub', sport, cardKey, 'reject', setSaving, setMessage)}
                  >
                    Devolver con correcciones
                  </button>
                </div>
              ) : null}
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
            {adSaving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            type="button"
            className="content-workspace__submit"
            disabled={adSaving || !selectedAdDraft || selectedAdDraft.status === 'pending_review'}
            onClick={() => void submitForReview(
              'ad',
              adSport,
              'app_general',
              setAdSaving,
              setAdMessage,
            )}
          >
            Enviar a aprobación
          </button>
          {adMessage ? <p role="status">{adMessage}</p> : null}
        </footer>
        <div className="content-workspace__status">
          Estado: {selectedAdDraft ? statusLabel(selectedAdDraft.status) : 'Publicidad publicada actual'}
          {selectedAdDraft?.review_note ? ` · Corrección: ${selectedAdDraft.review_note}` : ''}
        </div>
        {isApprover && selectedAdDraft?.status === 'pending_review' ? (
          <div className="content-workspace__review">
            <label>
              Observación para el editor
              <input
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="content-workspace__approve"
              disabled={adSaving}
              onClick={() => void review(
                'ad',
                adSport,
                'app_general',
                'approve',
                setAdSaving,
                setAdMessage,
              )}
            >
              Aprobar y publicar
            </button>
            <button
              type="button"
              className="content-workspace__reject"
              disabled={adSaving || !reviewNote.trim()}
              onClick={() => void review(
                'ad',
                adSport,
                'app_general',
                'reject',
                setAdSaving,
                setAdMessage,
              )}
            >
              Devolver
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
