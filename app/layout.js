import './globals.css';

export const metadata = {
  title: 'ConfirmaCNPJ — essa empresa existe?',
  description: 'Cole o link do site ou o CNPJ e confirme se a empresa existe.',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#070b18' };

export default function Layout({ children }) {
  return (<html lang="pt-BR"><body>{children}</body></html>);
}
