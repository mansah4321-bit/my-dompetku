import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'register';

interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password Visibility States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState<string | null>(null);

  // Forgot Password Modal States
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Email format validation helper
  const validateEmailFormat = (val: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val.trim());
  };

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg('');
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setRegisterSuccessMessage(null);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (errorMsg) setErrorMsg('');
    if (emailError && validateEmailFormat(val)) {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMsg) setErrorMsg('');
    if (passwordError && e.target.value.length >= 6) {
      setPasswordError('');
    }
    if (mode === 'register' && confirmPassword && e.target.value === confirmPassword) {
      setConfirmPasswordError('');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
    if (errorMsg) setErrorMsg('');
    if (nameError && e.target.value.trim().length >= 2) {
      setNameError('');
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (errorMsg) setErrorMsg('');
    if (confirmPasswordError && e.target.value === password) {
      setConfirmPasswordError('');
    }
  };

  // Menampilkan pesan error asli dari Supabase agar penyebabnya dapat diketahui secara akurat
  const getSupabaseErrorMessage = (error: any): string => {
    if (!error) return 'Terjadi kesalahan pada autentikasi.';
    if (typeof error === 'string') return error;
    return error.message || error.error_description || JSON.stringify(error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setEmailError('');
    setPasswordError('');
    setNameError('');
    setConfirmPasswordError('');
    setRegisterSuccessMessage(null);

    let hasError = false;

    // Validate Name (if register)
    if (mode === 'register') {
      const trimmedName = fullName.trim();
      if (!trimmedName) {
        setNameError('Nama lengkap wajib diisi');
        hasError = true;
      } else if (trimmedName.length < 2) {
        setNameError('Nama minimal 2 karakter');
        hasError = true;
      }
    }

    // Validate Email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email wajib diisi');
      hasError = true;
    } else if (!validateEmailFormat(trimmedEmail)) {
      setEmailError('Format email tidak valid (contoh: nama@email.com)');
      hasError = true;
    }

    // Validate Password
    if (!password) {
      setPasswordError('Password wajib diisi');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError('Password minimal 6 karakter');
      hasError = true;
    }

    // Validate Confirm Password (if register)
    if (mode === 'register') {
      if (!confirmPassword) {
        setConfirmPasswordError('Konfirmasi password wajib diisi');
        hasError = true;
      } else if (confirmPassword !== password) {
        setConfirmPasswordError('Konfirmasi password tidak cocok');
        hasError = true;
      }
    }

    if (hasError) {
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        // Supabase Auth: signInWithPassword
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password,
        });

        if (error) {
          setErrorMsg(getSupabaseErrorMessage(error));
          return;
        }

        if (data.session) {
          // Login successful, callback will direct to main page
          if (onSuccess) {
            onSuccess();
          }
        }
      } else {
        // Supabase Auth: signUp
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) {
          setErrorMsg(getSupabaseErrorMessage(error));
          return;
        }

        if (data.session) {
          // Auto logged in upon registration
          if (onSuccess) {
            onSuccess();
          }
        } else {
          // Email confirmation may be required
          setRegisterSuccessMessage(
            'Pendaftaran akun berhasil! Silakan periksa email Anda untuk verifikasi atau coba masuk langsung.'
          );
          setMode('login');
        }
      }
    } catch (err: any) {
      console.error('Supabase auth error:', err);
      setErrorMsg(
        err?.message
          ? getSupabaseErrorMessage(err)
          : 'Terjadi kesalahan sistem saat mencoba autentikasi.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    const target = forgotEmail.trim();
    if (!target || !validateEmailFormat(target)) {
      setForgotError('Masukkan email yang valid untuk reset password');
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target);
      if (error) {
        setForgotError(getSupabaseErrorMessage(error));
      } else {
        setForgotSubmitted(true);
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Gagal mengirim instruksi reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050B17] text-slate-100 flex items-center justify-center p-4 selection:bg-[#DFB76C] selection:text-[#050B17] relative overflow-hidden">
      {/* Subtle Background Radial Ambient Glows */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[340px] bg-[#DFB76C]/10 blur-[110px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-36 left-1/2 -translate-x-1/2 w-[460px] h-[320px] bg-sky-900/10 blur-[120px] rounded-full" />

      {/* Main Container - Mobile-first width (390–430px optimal, centered on desktop) */}
      <div className="w-full max-w-sm sm:max-w-md relative z-10 py-6">
        {/* Card Shell */}
        <div className="rounded-3xl bg-[#080E1E]/95 backdrop-blur-2xl border border-white/[0.08] p-7 sm:p-9 shadow-2xl shadow-black/60 relative overflow-hidden">
          {/* Subtle Top Gold Highlight Line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#DFB76C]/60 to-transparent" />

          {/* 1. Header: Logo, Nama Aplikasi, & by Firmansah */}
          <header className="flex flex-col items-center text-center mb-6">
            {/* Luxury Logo Monogram Emblem */}
            <div className="relative mb-3 group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#162347] to-[#0A132B] border border-[#DFB76C]/40 flex items-center justify-center shadow-lg shadow-[#DFB76C]/10 group-hover:border-[#DFB76C]/70 transition-all">
                <div className="relative flex items-center justify-center">
                  <span className="text-xl font-black font-mono tracking-tighter text-[#DFB76C]">
                    M
                  </span>
                  <div className="absolute -bottom-1 w-2.5 h-0.5 bg-[#DFB76C] rounded-full shadow-[0_0_8px_#DFB76C]" />
                </div>
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-[#DFB76C]/15 blur-md -z-10" />
            </div>

            {/* Brand Title */}
            <h1 className="text-xl sm:text-2xl font-black tracking-[0.2em] uppercase font-mono bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              MYDOMPET
            </h1>

            {/* Sub-brand / Author */}
            <p className="text-xs text-slate-400 font-medium tracking-wider mt-0.5">
              by <span className="text-[#DFB76C] font-semibold">Firmansah</span>
            </p>
          </header>

          {/* 2. Welcome Title & Subtitle */}
          <div className="mb-7 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Selamat Datang' : 'Buat Akun Baru'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              {mode === 'login'
                ? 'Kelola keuanganmu dengan lebih mudah.'
                : 'Mulai pantau pemasukan & pengeluaranmu dengan rapi.'}
            </p>
          </div>

          {/* Registration Success Alert Banner */}
          {registerSuccessMessage && (
            <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#DFB76C]/15 border border-[#DFB76C]/30 text-[#E5C365] text-xs animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#DFB76C]" />
              <p className="leading-relaxed">{registerSuccessMessage}</p>
            </div>
          )}

          {/* 3. Auth Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {/* General Error Banner */}
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Input Nama Lengkap (Only in Register Mode) */}
            {mode === 'register' && (
              <div className="space-y-1.5 text-left animate-in fade-in duration-200">
                <label
                  htmlFor="fullName"
                  className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Nama Lengkap
                </label>
                <div
                  className={`relative flex items-center rounded-2xl bg-[#050B17]/90 border transition-all ${
                    nameError
                      ? 'border-red-500/80 focus-within:border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]'
                      : 'border-white/10 focus-within:border-[#DFB76C] focus-within:shadow-[0_0_12px_rgba(223,183,108,0.15)]'
                  }`}
                >
                  <div className="pl-3.5 pr-1 text-slate-400">
                    <User size={17} />
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={fullName}
                    onChange={handleNameChange}
                    placeholder="Contoh: Firmansah"
                    disabled={isLoading}
                    className="w-full bg-transparent px-3 py-3 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
                  />
                </div>
                {nameError && (
                  <p className="text-[11px] font-medium text-red-400 pl-1 animate-in fade-in">
                    {nameError}
                  </p>
                )}
              </div>
            )}

            {/* Input Email */}
            <div className="space-y-1.5 text-left">
              <label
                htmlFor="email"
                className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider"
              >
                Email
              </label>
              <div
                className={`relative flex items-center rounded-2xl bg-[#050B17]/90 border transition-all ${
                  emailError
                    ? 'border-red-500/80 focus-within:border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]'
                    : 'border-white/10 focus-within:border-[#DFB76C] focus-within:shadow-[0_0_12px_rgba(223,183,108,0.15)]'
                }`}
              >
                <div className="pl-3.5 pr-1 text-slate-400">
                  <Mail size={17} />
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="nama@email.com"
                  disabled={isLoading}
                  className="w-full bg-transparent px-3 py-3 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
                />
              </div>
              {emailError && (
                <p className="text-[11px] font-medium text-red-400 pl-1 animate-in fade-in">
                  {emailError}
                </p>
              )}
            </div>

            {/* Input Password */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
                {/* Link Kecil: Lupa Password? (Only in Login Mode) */}
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotSubmitted(false);
                      setForgotError('');
                      setShowForgotPassword(true);
                    }}
                    className="text-[11px] text-[#DFB76C] hover:text-[#E5C365] transition-colors font-medium hover:underline focus:outline-none cursor-pointer"
                  >
                    Lupa password?
                  </button>
                )}
              </div>

              <div
                className={`relative flex items-center rounded-2xl bg-[#050B17]/90 border transition-all ${
                  passwordError
                    ? 'border-red-500/80 focus-within:border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]'
                    : 'border-white/10 focus-within:border-[#DFB76C] focus-within:shadow-[0_0_12px_rgba(223,183,108,0.15)]'
                }`}
              >
                <div className="pl-3.5 pr-1 text-slate-400">
                  <Lock size={17} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Minimal 6 karakter"
                  disabled={isLoading}
                  className="w-full bg-transparent px-3 py-3 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
                />
                {/* Toggle Show/Hide Password */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="pr-3.5 pl-1 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] font-medium text-red-400 pl-1 animate-in fade-in">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Input Konfirmasi Password (Only in Register Mode) */}
            {mode === 'register' && (
              <div className="space-y-1.5 text-left animate-in fade-in duration-200">
                <label
                  htmlFor="confirmPassword"
                  className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Konfirmasi Password
                </label>
                <div
                  className={`relative flex items-center rounded-2xl bg-[#050B17]/90 border transition-all ${
                    confirmPasswordError
                      ? 'border-red-500/80 focus-within:border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]'
                      : 'border-white/10 focus-within:border-[#DFB76C] focus-within:shadow-[0_0_12px_rgba(223,183,108,0.15)]'
                  }`}
                >
                  <div className="pl-3.5 pr-1 text-slate-400">
                    <Lock size={17} />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    placeholder="Ulangi kata sandi"
                    disabled={isLoading}
                    className="w-full bg-transparent px-3 py-3 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
                  />
                  {/* Toggle Show/Hide Confirm Password */}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="pr-3.5 pl-1 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {confirmPasswordError && (
                  <p className="text-[11px] font-medium text-red-400 pl-1 animate-in fade-in">
                    {confirmPasswordError}
                  </p>
                )}
              </div>
            )}

            {/* Action Button: Masuk / Daftar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-[#DFB76C] via-[#E5C365] to-[#C59B27] text-[#080E1E] font-bold text-sm tracking-wide shadow-lg shadow-[#DFB76C]/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-[#080E1E]" />
                    <span>{mode === 'login' ? 'Menghubungkan...' : 'Mendaftarkan akun...'}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Masuk' : 'Daftar Sekarang'}</span>
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </div>

            {/* Bottom Navigation Switcher */}
            <div className="pt-2 text-center">
              {mode === 'login' ? (
                <p className="text-xs text-slate-400">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('register')}
                    className="text-[#DFB76C] hover:text-[#E5C365] font-semibold transition-colors hover:underline focus:outline-none cursor-pointer"
                  >
                    Daftar Akun Baru
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Sudah memiliki akun?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('login')}
                    className="text-[#DFB76C] hover:text-[#E5C365] font-semibold transition-colors hover:underline focus:outline-none cursor-pointer"
                  >
                    Masuk ke Akun
                  </button>
                </p>
              )}
            </div>
          </form>

          {/* Minimalist Security Footer */}
          <footer className="mt-7 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck size={14} className="text-[#DFB76C]/70" />
            <span>Tersambung ke Supabase Authentication</span>
          </footer>
        </div>
      </div>

      {/* Modal / Dialog Lupa Password */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setShowForgotPassword(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#DFB76C]/15 text-[#DFB76C] flex items-center justify-center">
                  <Lock size={15} />
                </div>
                <h3 className="text-sm font-bold text-white">Lupa Password</h3>
              </div>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4">
              {forgotSubmitted ? (
                <div className="text-center py-3 space-y-2 animate-in fade-in">
                  <div className="w-10 h-10 rounded-full bg-[#DFB76C]/15 text-[#DFB76C] flex items-center justify-center mx-auto">
                    <CheckCircle2 size={22} />
                  </div>
                  <p className="text-xs font-semibold text-white">Tautan Terkirim</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Instruksi pemulihan kata sandi telah dikirim ke{' '}
                    <span className="text-[#DFB76C] font-medium">{forgotEmail}</span>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Masukkan email terdaftar Anda. Supabase akan mengirimkan tautan untuk mengatur ulang kata sandi.
                  </p>

                  {forgotError && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
                      {forgotError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Email Akun
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="nama@email.com"
                      disabled={forgotLoading}
                      className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C] disabled:opacity-50"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-95 transition-all shadow-md shadow-[#DFB76C]/20 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <span>Kirim Instruksi Reset</span>
                    )}
                  </button>
                </form>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="w-full py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
