import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Czcionki są hostowane lokalnie (bez Google Fonts), więc przeglądarka nie wysyła adresu IP użytkownika do osób trzecich.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './styles.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
