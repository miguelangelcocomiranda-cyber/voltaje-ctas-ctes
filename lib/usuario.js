// Los usuarios ingresan con un nombre de usuario (ej: "tomasm").
// Supabase necesita un mail, asi que internamente se arma uno que nunca recibe correos.
export const DOMINIO = 'usuarios.voltaje.com.ar';

export const aEmail = (u = '') => {
  const x = u.trim().toLowerCase();
  return x.includes('@') ? x : `${x}@${DOMINIO}`;
};

export const deEmail = (e = '') => (e.endsWith('@' + DOMINIO) ? e.split('@')[0] : e);

export const usuarioValido = (u = '') => /^[a-z0-9._-]{3,30}$/.test(u.trim().toLowerCase()) || u.includes('@');
