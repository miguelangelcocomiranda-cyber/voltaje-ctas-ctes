import { createClient } from '@supabase/supabase-js';

// Cliente con permisos totales: SOLO se usa en el servidor (rutas /api)
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Verifica que quien llama este logueado y sea ADMIN
export async function exigirAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return { error: 'No autorizado', status: 401 };
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { error: 'Sesión vencida, volvé a ingresar', status: 401 };
  const { data: perfil } = await sb.from('perfiles').select('rol').eq('id', data.user.id).single();
  if (perfil?.rol !== 'admin') return { error: 'Solo un administrador puede hacer esto', status: 403 };
  return { sb, usuario: data.user };
}
