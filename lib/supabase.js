import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Trae todas las filas de una consulta (Supabase devuelve maximo 1000 por pedido)
export async function traerTodo(armarConsulta) {
  const paso = 1000;
  let desde = 0;
  let todo = [];
  while (true) {
    const { data, error } = await armarConsulta().range(desde, desde + paso - 1);
    if (error) throw error;
    todo = todo.concat(data || []);
    if (!data || data.length < paso) break;
    desde += paso;
  }
  return todo;
}

// Llama a las rutas internas /api/... con el token del usuario logueado
export async function api(ruta, metodo = 'GET', cuerpo) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch(ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Error en el servidor');
  return json;
}
