// Web Audio API Sound Generator & Controller
// Menghasilkan efek suara UI modern, tajam, klik mouse realistis, dan volume mantap tanpa file audio eksternal

type SoundListener = (enabled: boolean, volume: number) => void;

class SoundService {
  private audioCtx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.65; // Volume mantap, jelas, dan renyah (dinaikkan dari 0.28)
  private listeners: Set<SoundListener> = new Set();
  private lastPlayTime: number = 0;
  private isInitialized: boolean = false;

  constructor() {
    this.isEnabled = true;
    try {
      if (typeof window !== 'undefined') {
        const savedVol = localStorage.getItem('mydompet_sound_volume');
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          // Jika nilai tersimpan adalah nilai lama yang terlalu kecil, upgrade ke volume baru yang lebih jelas
          if (!isNaN(parsed)) {
            this.volume = parsed <= 0.35 ? 0.65 : Math.max(0, Math.min(1, parsed));
          }
        }
      }
    } catch {}
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.isEnabled, this.volume);
      } catch {}
    });
  }

  public subscribe(listener: SoundListener): () => void {
    this.listeners.add(listener);
    listener(this.isEnabled, this.volume);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public initGlobalClickListener() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    const handleGlobalClick = (event: MouseEvent) => {
      if (!this.isEnabled) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Cek apakah elemen yang diklik atau leluhurnya adalah tombol atau clickable
      const buttonEl = target.closest('button, a, [role="button"], input[type="button"], input[type="submit"], select, .sound-click');
      
      if (buttonEl) {
        // Jangan trigger jika elemen punya attribute data-no-sound
        if (buttonEl.hasAttribute('data-no-sound')) return;

        // Cegah double-sound dalam interval 25ms
        const now = Date.now();
        if (now - this.lastPlayTime < 25) return;
        this.lastPlayTime = now;

        // Cek data-sound attribute jika ada kustomisasi
        const soundType = buttonEl.getAttribute('data-sound');
        switch (soundType) {
          case 'nav':
          case 'tab':
            this.playTab();
            break;
          case 'accordion':
          case 'swoosh':
            this.playAccordion();
            break;
          case 'income':
            this.playIncomeSuccess();
            break;
          case 'expense':
            this.playExpenseSuccess();
            break;
          case 'coin':
            this.playMultiCoin();
            break;
          case 'celebrate':
            this.playGoalCelebration();
            break;
          case 'warning':
            this.playBudgetWarning();
            break;
          case 'delete':
            this.playDelete();
            break;
          case 'modal-open':
          case 'modal':
            this.playModalOpen();
            break;
          case 'modal-close':
          case 'close':
            this.playModalClose();
            break;
          default:
            // Default: Suara Klik Mouse Renyah
            this.playMouseClick();
            break;
        }
      }
    };

    // Listen on capture phase for instant zero-latency response
    window.addEventListener('click', handleGlobalClick, { capture: true, passive: true });
  }

  public toggle(): boolean {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('mydompet_sound_enabled', enabled ? 'true' : 'false');
    } catch {}
    this.notify();
    if (enabled) {
      this.playMouseClick();
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('mydompet_sound_volume', this.volume.toString());
    } catch {}
    this.notify();
  }

  public getVolume(): number {
    return this.volume;
  }

  // =========================================================================
  // 1. INTERAKSI MIKRO HARIAN (MICRO-INTERACTIONS)
  // =========================================================================

  /**
   * Suara Klik Mouse Renyah (Authentic Mechanical / Optical Mouse Click)
   * Meniru mikro-sakelar mouse fisik: transient klik tajam + bodi 'tik' renyah
   */
  public playMouseClick() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume * 0.9, now);
      masterGain.connect(ctx.destination);

      // 1. Sharp Switch Transient (Metallic Click Impulse ~2.4kHz -> 1.2kHz)
      const oscHigh = ctx.createOscillator();
      const gainHigh = ctx.createGain();
      oscHigh.type = 'triangle';
      oscHigh.frequency.setValueAtTime(2400, now);
      oscHigh.frequency.exponentialRampToValueAtTime(1200, now + 0.012);

      gainHigh.gain.setValueAtTime(0.85, now);
      gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

      oscHigh.connect(gainHigh);
      gainHigh.connect(masterGain);

      oscHigh.start(now);
      oscHigh.stop(now + 0.014);

      // 2. Plastic Switch Body Resonance (Solid "Tak" ~780Hz -> ~340Hz)
      const oscBody = ctx.createOscillator();
      const gainBody = ctx.createGain();
      oscBody.type = 'sine';
      oscBody.frequency.setValueAtTime(780, now);
      oscBody.frequency.exponentialRampToValueAtTime(340, now + 0.024);

      gainBody.gain.setValueAtTime(0.7, now);
      gainBody.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

      oscBody.connect(gainBody);
      gainBody.connect(masterGain);

      oscBody.start(now);
      oscBody.stop(now + 0.026);

      // 3. Micro Release Click (Efek pelepasan pegas switch mikro)
      const oscRelease = ctx.createOscillator();
      const gainRelease = ctx.createGain();
      const releaseTime = now + 0.008;
      oscRelease.type = 'triangle';
      oscRelease.frequency.setValueAtTime(1850, releaseTime);
      oscRelease.frequency.exponentialRampToValueAtTime(950, releaseTime + 0.008);

      gainRelease.gain.setValueAtTime(0.4, releaseTime);
      gainRelease.gain.exponentialRampToValueAtTime(0.001, releaseTime + 0.008);

      oscRelease.connect(gainRelease);
      gainRelease.connect(masterGain);

      oscRelease.start(releaseTime);
      oscRelease.stop(releaseTime + 0.01);
    } catch {}
  }

  /**
   * Alias kompatibilitas playTap memanggil suara klik mouse
   */
  public playTap() {
    this.playMouseClick();
  }

  /**
   * Klik Navigasi (Crisp Bubble Snap)
   * Untuk perpindahan tab bawah & pergantian filter transaksi
   */
  public playTab() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(1150, now + 0.045);

      gain.gain.setValueAtTime(this.volume * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.048);
    } catch {}
  }

  /**
   * Buka / Tutup Akordeon Sub-Kategori (Swoosh Tick)
   * Untuk ekspansi/collapse detail anggaran subkategori
   */
  public playAccordion() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.048);

      gain.gain.setValueAtTime(this.volume * 0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.052);
    } catch {}
  }

  // =========================================================================
  // 2. AKSI FINANSIAL UTAMA (FINANCIAL TRIGGERS)
  // =========================================================================

  /**
   * Pencatatan Pemasukan (Gold Coin Shimmer / Upbeat Chime)
   * Saat sukses menyimpan transaksi uang masuk
   */
  public playIncomeSuccess() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Arpeggio cerah berkilau C5 -> E5 -> G5 -> C6 -> E6
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + idx * 0.045;
        const noteDuration = 0.22;

        osc.type = idx >= 3 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(this.volume * 0.85, noteStart + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + noteDuration);
      });
    } catch {}
  }

  /**
   * Pencatatan Pengeluaran (Clean Paper Snap / Solid Tap)
   * Saat sukses menyimpan transaksi pengeluaran
   */
  public playExpenseSuccess() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.065);

      gain.gain.setValueAtTime(this.volume * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  /**
   * Alias kompatibilitas
   */
  public playSuccess() {
    this.playIncomeSuccess();
  }

  /**
   * Isi Saldo Tabungan (Multi-Coin Drop: Clink-Clink-Clink)
   * Saat menambah setoran ke celengan/target impian
   */
  public playMultiCoin() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // 3 ketukan koin emas beruntun yang renyah
      const coins = [
        { freq1: 1046.5, freq2: 2093.0, time: 0 },
        { freq1: 1244.51, freq2: 2489.02, time: 0.06 },
        { freq1: 1396.91, freq2: 2793.83, time: 0.125 },
      ];

      coins.forEach((coin) => {
        const start = now + coin.time;
        const dur = 0.22;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(coin.freq1, start);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(coin.freq2, start);

        gain.gain.setValueAtTime(this.volume * 0.8, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(start);
        osc2.start(start);
        osc1.stop(start + dur);
        osc2.stop(start + dur);
      });
    } catch {}
  }

  public playCoin() {
    this.playMultiCoin();
  }

  // =========================================================================
  // 3. NOTIFIKASI STATUS & PERINGATAN ANGGARAN
  // =========================================================================

  /**
   * Target Tabungan Tercapai (Celebration Chime Chord)
   * Ketika tabungan mencapai 100% dari target
   */
  public playGoalCelebration() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Major Arpeggio Chime: C5, E5, G5, C6, E6, G6
      const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.055;
        const dur = 0.45;

        osc.type = idx >= 3 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.9, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {}
  }

  /**
   * Peringatan Batas Anggaran (Soft Dual-Tone Alert)
   * Saat pengeluaran mendekati atau melebihi 90%–100% kapasitas anggaran
   */
  public playBudgetWarning() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Dual tone ramah & jelas: F#5 (740Hz) -> D5 (587Hz)
      const tones = [
        { freq: 739.99, start: 0, dur: 0.14 },
        { freq: 587.33, start: 0.11, dur: 0.18 },
      ];

      tones.forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + t.start;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(this.volume * 0.85, noteStart + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + t.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + t.dur);
      });
    } catch {}
  }

  /**
   * Hapus Data (Low Pitch Plop)
   * Saat membatalkan atau menghapus transaksi / target / budget
   */
  public playDelete() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

      gain.gain.setValueAtTime(this.volume * 0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.095);
    } catch {}
  }

  // =========================================================================
  // 4. BUKA DIALOG & MODAL (SPATIAL SOUND)
  // =========================================================================

  /**
   * Buka Modal / Form (Air Swell Pop)
   * Saat klik tombol + Tambah Transaksi, Isi Tabungan, atau Tambah Anggaran
   */
  public playModalOpen() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

      gain.gain.setValueAtTime(this.volume * 0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.065);
    } catch {}
  }

  /**
   * Tutup / Batal Modal (Soft Dismiss Tap)
   * Saat menekan tombol silang (X) atau klik tutup/batal
   */
  public playModalClose() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(230, now + 0.045);

      gain.gain.setValueAtTime(this.volume * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.048);
    } catch {}
  }
}

export const soundService = new SoundService();
