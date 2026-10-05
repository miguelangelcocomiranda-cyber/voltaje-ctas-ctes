import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

async function hayUsuarios(sb) {
  const { count, error } = await sb.from('perfiles').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count || 0) > 0;
}

// GET: ¿hace falta crear el primer administrador?
export async function GET() {
  try {
    const sb = supabaseAdmin();
    return NextResponse.json({ necesitaSetup: !(await hayUsuarios(sb)) });
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo conectar con la base. Revisá las variables en Vercel.' }, { status: 500 });
  }
}

// POST: crea el primer administrador (solo funciona si no hay ningun usuario)
export async function POST(req) {
  try {
    const sb = supabaseAdmin();
    if (await hayUsuarios(sb)) return NextResponse.json({ error: 'Ya existe un administrador' }, { status: 400 });
    const { nombre, email, password } = await req.json();
    if (!email || !password || password.length < 8)
      return NextResponse.json({ error: 'Completá mail y una contraseña de al menos 8 caracteres' }, { status: 400 });
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await sb.from('perfiles').upsert({ id: data.user.id, email, nombre: nombre || email, rol: 'admin' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
