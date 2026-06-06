import { supabase } from '../supabaseClient';

const API_BASE = process.env.REACT_APP_API_URL || 'https://padbol-backend.onrender.com';

export async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function fetchPartido(partidoId) {
  const res = await fetch(`${API_BASE}/api/scoreboard/partidos/${partidoId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al cargar partido');
  return data;
}

export async function fetchSponsors(sedeId) {
  const res = await fetch(`${API_BASE}/api/scoreboard/sponsors/${sedeId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al cargar sponsors');
  return data.sponsors || [];
}

export async function scoreboardAction(path, method = 'POST') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { method, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la acción');
  return data;
}

export async function createPartido(payload) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/scoreboard/partidos`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear partido');
  return data;
}

export { API_BASE };
