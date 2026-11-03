import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Czcionki są hostowane lokalnie (bez Google Fonts), więc przeglądarka nie wysyła adresu IP użytkownika do osób trzecich.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/cyrillic-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/cyrillic-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/cyrillic-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-700.css';
import '@fontsource/inter/cyrillic-700.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-ext-600.css';
import '@fontsource/fraunces/latin-700.css';
import '@fontsource/fraunces/latin-ext-700.css';
// Fraunces не має кирилиці: для заголовків українського інтерфейсу беремо Lora (лише кирилиця й латиниця, 600 і 700)
import '@fontsource/lora/cyrillic-600.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/cyrillic-700.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-ext-400.css';
import '@fontsource/roboto/cyrillic-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-ext-500.css';
import '@fontsource/roboto/cyrillic-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-ext-700.css';
import '@fontsource/roboto/cyrillic-700.css';
import './styles.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
