import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { LoginPage } from './pages/LoginPage';
import { HalamanUtama } from './pages/HalamanUtama';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    // 1. Ambil session yang tersimpan saat halaman dimuat / direfresh
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setIsLoadingSession(false);
      })
      .catch((err) => {
        console.error('Gagal mengambil session Supabase:', err);
        setIsLoadingSession(false);
      });

    // 2. Dengarkan perubahan status autentikasi (login, logout, refresh token)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoadingSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Loading state yang elegan saat inisialisasi session
  if (isLoadingSession) {
    return (
      <div className="min-h-screen w-full bg-[#050B17] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Ambient radial glow */}
        <div className="pointer-events-none absolute w-80 h-80 bg-[#DFB76C]/10 blur-[100px] rounded-full" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#162347] to-[#0A132B] border border-[#DFB76C]/40 flex items-center justify-center shadow-lg shadow-[#DFB76C]/15 animate-pulse">
            <span className="text-xl font-black font-mono text-[#DFB76C]">M</span>
          </div>
          <div className="text-center">
            <p className="text-xs font-mono tracking-widest text-[#DFB76C] uppercase font-bold">
              MYDOMPET
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Memuat sesi...</p>
          </div>
        </div>
      </div>
    );
  }

  // Jika sudah login, tampilkan Halaman Utama
  if (session) {
    return (
      <HalamanUtama
        key={session.user.id}
        session={session}
        onLogout={() => setSession(null)}
      />
    );
  }

  // Jika belum login, tampilkan Halaman Login
  return <LoginPage onSuccess={() => {}} />;
}
