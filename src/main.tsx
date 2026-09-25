import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { soundService } from './services/soundService';

// Inisialisasi Audio Interaktif Global untuk semua tombol & aksi klik
soundService.initGlobalClickListener();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
