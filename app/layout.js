import './globals.css';

export const metadata = {
  title: 'Ctas Ctes · Voltaje Iluma',
  description: 'Cuentas corrientes de clientes Voltaje e Iluma',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
