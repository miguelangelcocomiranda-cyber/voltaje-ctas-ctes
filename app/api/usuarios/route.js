import { NextResponse } from 'next/server';
import { exigirAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';
const err = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

// Lista de usuarios
export async function GET(req) {
  const a = await exigirAdmin(req);
  if (a.error) return err(a.error, a.status);
  const { data, error } = await a.sb.from('perfiles').select('id,email,nombre,rol,creado').order('creado');
  if (error) return err(error.message, 500);
  return NextResponse.json({ usuarios: data });
}

// Crear usuario
export async function POST(req) {
  const a = await exigirAdmin(req);
  if (a.error) return err(a.error, a.status);
  const body = await req.json();
  const nombre = (body.nombre || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = (body.password || '').trim();
  const rol = body.rol;
  if (!email || !password || password.length < 8) return err('Completá mail y una contraseña de al menos 8 caracteres');
  if (!['admin', 'lector'].includes(rol)) return err('Rol inválido');
  const { data, error } = await a.sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return err(error.message.includes('already') ? 'Ese mail ya tiene usuario' : error.message);
  await a.sb.from('perfiles').upsert({ id: data.user.id, email, nombre: nombre || email, rol });
  return NextResponse.json({ ok: true });
}

// Cambiar rol o contraseña
export async function PATCH(req) {
  const a = await exigirAdmin(req);
  if (a.error) return err(a.error, a.status);
  const body = await req.json();
  const { id, rol } = body;
  const password = (body.password || '').trim();
  if (!id) return err('Falta el usuario');
  if (rol) {
    if (!['admin', 'lector'].includes(rol)) return err('Rol inválido');
    if (id === a.usuario.id && rol !== 'admin') return err('No podés quitarte el rol de admin a vos mismo');
    const { error } = await a.sb.from('perfiles').update({ rol }).eq('id', id);
    if (error) return err(error.message, 500);
  }
  if (password) {
    if (password.length < 8) return err('La contraseña debe tener al menos 8 caracteres');
    const { error } = await a.sb.auth.admin.updateUserById(id, { password });
    if (error) return err(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}

// Dar de baja
export async function DELETE(req) {
  const a = await exigirAdmin(req);
  if (a.error) return err(a.error, a.status);
  const { id } = await req.json();
  if (id === a.usuario.id) return err('No podés darte de baja a vos mismo');
  const { error } = await a.sb.auth.admin.deleteUser(id);
  if (error) return err(error.message, 500);
  return NextResponse.json({ ok: true });
}
