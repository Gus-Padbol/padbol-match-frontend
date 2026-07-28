import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'user_role_data';
const API_BASE_URL = 'https://padbol-backend.onrender.com';

export default function useUserRole(currentCliente) {
  const [roleData, setRoleData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(!roleData);

  useEffect(() => {
    if (!currentCliente?.email) {
      // Logout: clear stored role
      localStorage.removeItem(STORAGE_KEY);
      setRoleData(null);
      setLoading(false);
      return;
    }

    // El backend consulta por user_id con service role. Evita que una política
    // RLS del cliente deje al panel administrativo esperando indefinidamente.
    setLoading(true);
    let alive = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    async function loadRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('No hay una sesión activa');

        const response = await fetch(`${API_BASE_URL}/api/auth/mi-rol`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'No se pudo validar el rol');

        const rol = String(data?.rol || data?.role || '').trim().toLowerCase() || null;
        const result = rol
          ? {
              email: currentCliente.email,
              rol,
              nombre: data?.nombre ?? null,
              pais: data?.pais ?? null,
              sedeId: data?.sede_id ?? data?.sedeId ?? null,
              torneosOficialesHabilitados: Boolean(data?.torneosOficialesHabilitados),
            }
          : null;

        if (!alive) return;
        setRoleData(result);
        if (result) localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        else localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        if (!alive) return;
        console.error('useUserRole fetch error:', error.message);
        setRoleData(null);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (alive) setLoading(false);
        window.clearTimeout(timeout);
      }
    }

    void loadRole();
    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [currentCliente?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    rol:                          roleData?.rol                          ?? null,
    nombre:                       roleData?.nombre                       ?? null,
    pais:                         roleData?.pais                         ?? null,
    sedeId:                       roleData?.sedeId                       ?? null,
    torneosOficialesHabilitados:  roleData?.torneosOficialesHabilitados  ?? false,
    loading,
  };
}
