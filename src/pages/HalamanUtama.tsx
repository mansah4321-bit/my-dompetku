import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LogOut,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Home,
  Receipt,
  Plus,
  Sparkles,
  Search,
  X,
  Pencil,
  Trash2,
  Settings,
  Tag,
  PieChart as PieIcon,
  Camera,
  User,
  Upload,
  Check,
  Target,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Film,
  HeartPulse,
  GraduationCap,
  Cloud,
  Database,
  Copy,
  RefreshCw,
  CheckCheck,
  FileSpreadsheet,
  FileText,
  Download
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { soundService } from '../services/soundService';
import { exportTransactionsToExcel } from '../services/excelExportService';
import { exportTransactionsToPdf } from '../services/pdfExportService';
import {
  fetchBudgetsFromSupabase,
  syncBudgetToSupabase,
  syncAllBudgetsToSupabase,
  deleteBudgetFromSupabase,
  syncBudgetCapacityToSupabase,
  BUDGET_TABLE_SQL
} from '../services/budgetSyncService';
import {
  fetchUserAvatarFromSupabase,
  saveUserAvatarToSupabase,
  removeUserAvatarFromSupabase
} from '../services/avatarSyncService';

interface HalamanUtamaProps {
  session: Session;
  onLogout?: () => void;
}

type TabType = 'beranda' | 'transaksi' | 'tabungan' | 'anggaran';
type FilterType = 'all' | 'income' | 'expense';

interface TransactionItem {
  id: string;
  type: 'income' | 'expense';
  title: string;
  description?: string;
  category: string;
  subCategory?: string;
  amount: number;
  date: string;
  notes?: string;
}

interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
  targetDate: string;
  color: string;
}

export interface SubCategoryBudget {
  id: string;
  name: string;
  limit: number;
}

export interface BudgetItem {
  id: string;
  category: string;
  monthlyLimit: number;
  color?: string;
  subcategories?: SubCategoryBudget[];
}

// Preset default subkategori per kategori pengeluaran
export const DEFAULT_CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
  Makanan: ['Makan Pokok', 'Ngopi & Jajan', 'Bahan Masak/Sembako', 'Pesan Antar'],
  Transportasi: ['Bensin', 'Ojek Online/Taksi', 'Parkir & Tol', 'Servis Kendaraan'],
  Belanja: ['Pakaian & Aksesoris', 'Elektronik & Gadget', 'Kebutuhan Harian', 'Hobi'],
  Tagihan: ['Listrik & Air', 'WiFi & Internet', 'Pulsa & Paket Data', 'Sewa/Kos'],
  Hiburan: ['Bioskop & Nonton', 'Langganan Streaming', 'Liburan & Wisata', 'Game'],
  Kesehatan: ['Obat & Vitamin', 'Dokter & Klinik', 'Olahraga & Gym'],
  Pendidikan: ['Buku & Kursus', 'SPP/Uang Sekolah', 'Alat Tulis'],
  Lainnya: ['Lain-lain'],
};

export const getCategoryIconComponent = (categoryName: string) => {
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('makan') || cat.includes('food') || cat.includes('minum') || cat.includes('kuliner') || cat.includes('jajan') || cat.includes('kopi')) return Utensils;
  if (cat.includes('transpor') || cat.includes('kendaraan') || cat.includes('bensin') || cat.includes('ojek') || cat.includes('taksi') || cat.includes('parkir')) return Car;
  if (cat.includes('belanja') || cat.includes('shop') || cat.includes('mall') || cat.includes('pakaian')) return ShoppingBag;
  if (cat.includes('tagihan') || cat.includes('listrik') || cat.includes('air') || cat.includes('wifi') || cat.includes('internet') || cat.includes('pulsa')) return Zap;
  if (cat.includes('hiburan') || cat.includes('game') || cat.includes('nonton') || cat.includes('film') || cat.includes('liburan') || cat.includes('wisata')) return Film;
  if (cat.includes('kesehatan') || cat.includes('obat') || cat.includes('dokter') || cat.includes('medis') || cat.includes('gym') || cat.includes('olahraga')) return HeartPulse;
  if (cat.includes('pendidikan') || cat.includes('buku') || cat.includes('kursus') || cat.includes('sekolah') || cat.includes('kuliah') || cat.includes('spp')) return GraduationCap;
  return Tag;
};

// Helper fungsi penyimpanan terisolasi per akun Supabase (User ID)
const getUserStorageKey = (uid: string, key: string) => `mydompet_usr_${uid}_${key}`;

const loadUserCategorySubcategories = (uid: string): Record<string, string[]> => {
  try {
    const key = getUserStorageKey(uid, 'category_subcategories');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) return JSON.parse(userSaved);
    return {};
  } catch {
    return {};
  }
};

const loadUserIncomeCategories = (uid: string): string[] => {
  try {
    const key = getUserStorageKey(uid, 'income_categories');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) {
      const parsed = JSON.parse(userSaved);
      const defaultPresetIncome = ['Gaji Utama', 'Bonus & Tunjangan', 'Hasil Usaha', 'Investasi & Dividen', 'Hadiah/Hibah', 'Lainnya'];
      if (Array.isArray(parsed) && parsed.every((cat: string) => defaultPresetIncome.includes(cat))) {
        localStorage.removeItem(key);
        return [];
      }
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
};

const loadUserExpenseCategories = (uid: string): string[] => {
  try {
    const key = getUserStorageKey(uid, 'expense_categories');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) {
      const parsed = JSON.parse(userSaved);
      const defaultPresetExpense = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'];
      if (Array.isArray(parsed) && parsed.every((cat: string) => defaultPresetExpense.includes(cat))) {
        localStorage.removeItem(key);
        return [];
      }
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
};


const loadUserTransactions = (uid: string): TransactionItem[] => {
  try {
    const key = getUserStorageKey(uid, 'transactions');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) return JSON.parse(userSaved);
    const legacy = localStorage.getItem('mydompet_clean_transactions');
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem('mydompet_clean_transactions');
      return JSON.parse(legacy);
    }
    return [];
  } catch {
    return [];
  }
};

const loadUserSavings = (uid: string): SavingsGoal[] => {
  try {
    const key = getUserStorageKey(uid, 'savings');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) return JSON.parse(userSaved);
    const legacy = localStorage.getItem('mydompet_clean_savings');
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem('mydompet_clean_savings');
      return JSON.parse(legacy);
    }
    return [];
  } catch {
    return [];
  }
};

const loadUserBudgets = (uid: string): BudgetItem[] => {
  try {
    const key = getUserStorageKey(uid, 'budgets');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) {
      const parsed = JSON.parse(userSaved);
      // Jika tersimpan data preset default lama (b-1, b-2, b-3, b-4), bersihkan agar kosong
      const isOldPreset =
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((b: any) => ['b-1', 'b-2', 'b-3', 'b-4'].includes(b?.id));
      if (isOldPreset) {
        localStorage.removeItem(key);
        return [];
      }
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
};

const loadUserBudgetCapacity = (uid: string): number | null => {
  try {
    const key = getUserStorageKey(uid, 'budget_capacity');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) {
      const parsed = parseInt(userSaved, 10);
      if (parsed === 3550000 || parsed === 3500000) {
        localStorage.removeItem(key);
        return null;
      }
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper kompresi gambar foto profil agar hemat data dan cepat sync lintas perangkat di Supabase
const compressImage = (file: File, maxWidth = 320, maxHeight = 320, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const loadUserAvatar = (session: Session | null | undefined, uid: string): string => {
  try {
    // 1. Prioritaskan avatar dari Supabase Auth Metadata akun (tersinkronisasi antar perangkat)
    const metaAvatar =
      session?.user?.user_metadata?.avatar_url ||
      session?.user?.user_metadata?.avatar ||
      session?.user?.user_metadata?.picture;
    if (metaAvatar && typeof metaAvatar === 'string' && metaAvatar.trim()) {
      return metaAvatar;
    }

    // 2. Cek cache lokal per user
    const key = getUserStorageKey(uid, 'avatar');
    const userSaved = localStorage.getItem(key);
    if (userSaved !== null) return userSaved;
    const legacy = localStorage.getItem('mydompet_user_avatar');
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem('mydompet_user_avatar');
      return legacy;
    }
    return '';
  } catch {
    return '';
  }
};

export const HalamanUtama: React.FC<HalamanUtamaProps> = ({ session, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ID Unik akun pengguna aktif untuk isolasi data total
  const userId = session?.user?.id || 'guest';

  // Profile Photo Manual Upload State (Tersinkronisasi lintas perangkat ke Supabase)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string>(() => loadUserAvatar(session, userId));
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState<'income' | 'expense'>('expense');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalTab, setCategoryModalTab] = useState<'expense' | 'income'>('expense');

  // Edit Transaction State
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);

  // Savings Modals State
  const [showAddSavingsModal, setShowAddSavingsModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  // Budget Modals & Editing State
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');

  // Sub-kategori Budget & Akordeon Expansion
  const [expandedBudgets, setExpandedBudgets] = useState<Record<string, boolean>>({
    'b-1': true, // default expand Makanan agar pengguna langsung paham fiturnya
  });
  const [editingBudgetSubcategories, setEditingBudgetSubcategories] = useState<SubCategoryBudget[]>([]);

  // Kapasitas Budget Bulanan (Bisa diedit langsung oleh pengguna)
  const [customOverallBudget, setCustomOverallBudget] = useState<number | null>(() =>
    loadUserBudgetCapacity(userId)
  );
  const [showEditCapacityModal, setShowEditCapacityModal] = useState(false);
  const [capacityInput, setCapacityInput] = useState('');

  // Donut Chart State (Toggle Expense / Income)
  const [donutType, setDonutType] = useState<'expense' | 'income'>('expense');
  const [hoveredDonutSlice, setHoveredDonutSlice] = useState<string | null>(null);

  // ========================================================
  // STATE DENGAN PERSISTENSI TERISOLASI PER AKUN SUPABASE
  // Data akun A dan akun B 100% terpisah dan tidak akan tercampur
  // ========================================================
  const [incomeCategories, setIncomeCategories] = useState<string[]>(() =>
    loadUserIncomeCategories(userId)
  );

  const [expenseCategories, setExpenseCategories] = useState<string[]>(() =>
    loadUserExpenseCategories(userId)
  );

  // Daftar Subkategori per Kategori Pengeluaran
  const [categorySubcategories, setCategorySubcategories] = useState<Record<string, string[]>>(() =>
    loadUserCategorySubcategories(userId)
  );

  // TRANSAKSI DARI SUPABASE DATABASE & CACHE LOKAL
  const [transactions, setTransactions] = useState<TransactionItem[]>(() =>
    loadUserTransactions(userId)
  );
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() =>
    loadUserSavings(userId)
  );

  const [budgets, setBudgets] = useState<BudgetItem[]>(() =>
    loadUserBudgets(userId)
  );

  // Status Sinkronisasi Anggaran ke Supabase Database
  const [, setBudgetSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'local_only' | 'error'>('idle');

  // Ambil data anggaran & kapasitas dari Supabase Database
  const fetchBudgets = async (uid: string) => {
    if (!uid || uid === 'guest') return;
    setBudgetSyncStatus('syncing');
    try {
      const res = await fetchBudgetsFromSupabase(uid);
      if (res.budgets !== null) {
        setBudgets(res.budgets);
        setCustomOverallBudget(res.budgetCapacity);
        setBudgetSyncStatus('synced');
      } else if (res.error) {
        setBudgetSyncStatus('local_only');
      }
    } catch {
      setBudgetSyncStatus('local_only');
    }
  };

  // Ambil transaksi milik user yang sedang login dari Supabase Database
  const fetchTransactions = async (uid: string) => {
    if (!uid || uid === 'guest') {
      setIsLoadingTransactions(false);
      return;
    }

    // Jika sudah ada data transaksi lokal, jangan tampilkan loading spinner agar riwayat muncul instan!
    const localData = loadUserTransactions(uid);
    if (!localData || localData.length === 0) {
      setIsLoadingTransactions(true);
    } else {
      setIsLoadingTransactions(false);
    }

    // Safety fallback timeout (maks 1 detik) agar loading spinner hilang cepat
    const timer = setTimeout(() => {
      setIsLoadingTransactions(false);
    }, 1000);

    try {
      let fetchedRows: any[] | null = null;

      // Promise timeout 3 detik untuk query Supabase
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: 'timeout' }), 3000)
      );

      // 1. Coba query dengan filter user_id
      const query1: any = await Promise.race([
        supabase.from('transactions').select('*').eq('user_id', uid),
        timeoutPromise
      ]);

      if (!query1.error && query1.data) {
        fetchedRows = query1.data;
      } else if (query1.error !== 'timeout') {
        // 2. Fallback query jika filter user_id tidak didukung
        const query2: any = await Promise.race([
          supabase.from('transactions').select('*'),
          timeoutPromise
        ]);

        if (!query2.error && query2.data) {
          fetchedRows = query2.data.filter((row: any) => !row.user_id || row.user_id === uid);
        }
      }

      if (fetchedRows && Array.isArray(fetchedRows) && fetchedRows.length > 0) {
        const mapped: TransactionItem[] = fetchedRows.map((row: any) => {
          let parsedNotes = row.notes || undefined;
          let parsedSubCategory = row.sub_category || row.subcategory || undefined;

          if (!parsedSubCategory && typeof parsedNotes === 'string') {
            const match = parsedNotes.match(/\[Sub:\s*([^\]]+)\]/i);
            if (match) {
              parsedSubCategory = match[1].trim();
              parsedNotes = parsedNotes.replace(/\[Sub:\s*([^\]]+)\]/i, '').trim() || undefined;
            }
          }

          const resolvedDate =
            row.date ||
            row.transaction_date ||
            (row.created_at ? String(row.created_at).split('T')[0] : null) ||
            new Date().toISOString().split('T')[0];

          return {
            id: String(row.id),
            type: row.type === 'income' ? 'income' : 'expense',
            title: row.description || row.title || row.name || 'Transaksi',
            description: row.description || row.title || '',
            category: row.category || row.kategori || (row.type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
            subCategory: parsedSubCategory,
            amount: Number(row.amount) || 0,
            date: String(resolvedDate),
            notes: parsedNotes,
          };
        });

        mapped.sort((a, b) => {
          const timeA = new Date(a.date).getTime() || 0;
          const timeB = new Date(b.date).getTime() || 0;
          return timeB - timeA;
        });

        setTransactions((current) => {
          const remoteIds = new Set(mapped.map((m) => m.id));
          const localUnsynced = current.filter((c) => c.id.startsWith('tx_') && !remoteIds.has(c.id));
          const combined = [...localUnsynced, ...mapped];
          try {
            localStorage.setItem(getUserStorageKey(uid, 'transactions'), JSON.stringify(combined));
          } catch {}
          return combined;
        });
      }
    } catch {
      // Data tetap aman di memory dan local cache jika ada kendala jaringan
    } finally {
      clearTimeout(timer);
      setIsLoadingTransactions(false);
    }
  };

  // Sinkronisasi data ulang jika akun/userId berganti
  useEffect(() => {
    setIncomeCategories(loadUserIncomeCategories(userId));
    setExpenseCategories(loadUserExpenseCategories(userId));
    setTransactions(loadUserTransactions(userId));
    setSavingsGoals(loadUserSavings(userId));
    setBudgets(loadUserBudgets(userId));
    setCustomOverallBudget(loadUserBudgetCapacity(userId));
    setUserAvatar(loadUserAvatar(session, userId));

    if (userId && userId !== 'guest') {
      fetchTransactions(userId);
      fetchBudgets(userId);

      // Ambil foto profil terbaru dari Supabase Server (Auth Metadata + Database Cloud)
      fetchUserAvatarFromSupabase(userId).then((cloudAvatar) => {
        if (cloudAvatar) {
          setUserAvatar(cloudAvatar);
        }
      });

      // Realtime listener Supabase: Kapasitas Total & Budget otomatis sama di semua perangkat
      const channel = supabase
        .channel(`realtime_settings_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            if (payload?.new && payload.new.budget_capacity !== undefined) {
              const cap = payload.new.budget_capacity !== null ? Number(payload.new.budget_capacity) : null;
              setCustomOverallBudget(cap);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'budgets',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            fetchBudgets(userId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setIsLoadingTransactions(false);
    }
  }, [userId, session]);

  // Simpan otomatis transaksi & kategori ke localStorage khusus akun yang sedang login
  useEffect(() => {
    try {
      localStorage.setItem(
        getUserStorageKey(userId, 'transactions'),
        JSON.stringify(transactions)
      );
    } catch (e) {
      console.error(e);
    }
  }, [transactions, userId]);

  // Simpan otomatis kategori & tabungan ke localStorage khusus akun yang sedang login
  useEffect(() => {
    try {
      localStorage.setItem(
        getUserStorageKey(userId, 'income_categories'),
        JSON.stringify(incomeCategories)
      );
    } catch (e) {
      console.error(e);
    }
  }, [incomeCategories, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getUserStorageKey(userId, 'expense_categories'),
        JSON.stringify(expenseCategories)
      );
    } catch (e) {
      console.error(e);
    }
  }, [expenseCategories, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getUserStorageKey(userId, 'category_subcategories'),
        JSON.stringify(categorySubcategories)
      );
    } catch (e) {
      console.error(e);
    }
  }, [categorySubcategories, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getUserStorageKey(userId, 'savings'),
        JSON.stringify(savingsGoals)
      );
    } catch (e) {
      console.error(e);
    }
  }, [savingsGoals, userId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getUserStorageKey(userId, 'budgets'),
        JSON.stringify(budgets)
      );
    } catch (e) {
      console.error(e);
    }
  }, [budgets, userId]);

  useEffect(() => {
    try {
      const key = getUserStorageKey(userId, 'budget_capacity');
      if (customOverallBudget !== null && customOverallBudget !== undefined) {
        localStorage.setItem(key, customOverallBudget.toString());
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error(e);
    }
  }, [customOverallBudget, userId]);

  // Handler Upload Foto Profil Lintas Perangkat (Sync Supabase Auth Metadata, Storage & Database)
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cek batas ukuran file (maks 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran foto maksimal 10MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const res = await saveUserAvatarToSupabase(userId, file);
      if (res.success && res.avatarUrl) {
        setUserAvatar(res.avatarUrl);
        setToastMessage('Berhasil');
      } else {
        // Fallback local base64
        const compressedBase64 = await compressImage(file, 200, 200, 0.8);
        setUserAvatar(compressedBase64);
        setToastMessage('Berhasil');
      }
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error('Gagal memproses foto:', err);
      alert('Gagal memproses foto. Silakan coba file gambar lain.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectPresetAvatar = async (avatarUrl: string) => {
    setIsUploadingPhoto(true);
    setUserAvatar(avatarUrl);
    try {
      await saveUserAvatarToSupabase(userId, avatarUrl);
      setToastMessage('Berhasil');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploadingPhoto(true);
    setUserAvatar('');
    try {
      await removeUserAvatarFromSupabase(userId);
      setToastMessage('Berhasil');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Category Edit State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  // Form State for Adding Transaction
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  // Form State for New Savings Goal
  const [newSavingsTitle, setNewSavingsTitle] = useState('');
  const [newSavingsCategory, setNewSavingsCategory] = useState('');
  const [newSavingsTarget, setNewSavingsTarget] = useState('');
  const [newSavingsInitial, setNewSavingsInitial] = useState('');
  const [newSavingsDate, setNewSavingsDate] = useState('');

  // Transaction Filter Tab
  const [trxFilter, setTrxFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      setToastMessage('Berhasil');
      await supabase.auth.signOut();
      if (onLogout) {
        onLogout();
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const userEmail = session.user.email || 'Pengguna';
  const userName =
    (session.user.user_metadata?.full_name as string) ||
    (session.user.user_metadata?.name as string) ||
    userEmail.split('@')[0] ||
    'Pengguna';

  // Preset luxury profile avatars
  const presetAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  ];

  // Calculations
  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalSavings = useMemo(() => {
    return savingsGoals.reduce((sum, s) => sum + s.currentAmount, 0);
  }, [savingsGoals]);

  const currentBalance = totalIncome - totalExpense;

  // Format Rupiah standar Indonesia
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Filtered Transactions in Transaksi Tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = trxFilter === 'all' ? true : t.type === trxFilter;
      const matchQuery =
        searchQuery.trim() === ''
          ? true
          : t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchQuery;
    });
  }, [transactions, trxFilter, searchQuery]);

  // Donut Chart Data Calculation
  const donutData = useMemo(() => {
    const map: Record<string, number> = {};
    const relevantTxs = transactions.filter((t) => t.type === donutType);

    relevantTxs.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });

    const total = Object.values(map).reduce((a, b) => a + b, 0);
    const palette =
      donutType === 'expense'
        ? ['#EF4444', '#DFB76C', '#38BDF8', '#A78BFA', '#F59E0B', '#34D399', '#EC4899', '#6366F1']
        : ['#DFB76C', '#10B981', '#38BDF8', '#A78BFA', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6'];

    return Object.entries(map)
      .map(([category, amount], idx) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: palette[idx % palette.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, donutType]);

  const totalDonutAmount = useMemo(() => {
    return donutData.reduce((sum, item) => sum + item.amount, 0);
  }, [donutData]);

  // Kalkulasi Alokasi Budget Bulanan Real-Time dari Transaksi Supabase
  const budgetAnalytics = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed
    const now = new Date();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);

    // Filter transaksi pengeluaran bulan berjalan
    const thisMonthExpenses = transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const categoryExpenseMap: Record<string, number> = {};
    const subcategoryExpenseMap: Record<string, Record<string, number>> = {};

    thisMonthExpenses.forEach((t) => {
      const cat = t.category || 'Lainnya';
      categoryExpenseMap[cat] = (categoryExpenseMap[cat] || 0) + t.amount;

      if (!subcategoryExpenseMap[cat]) {
        subcategoryExpenseMap[cat] = {};
      }
      const sub = t.subCategory?.trim() || 'Lain-lain';
      subcategoryExpenseMap[cat][sub] = (subcategoryExpenseMap[cat][sub] || 0) + t.amount;
    });

    const items = budgets.map((b) => {
      const spent = categoryExpenseMap[b.category] || 0;
      const limit = b.monthlyLimit || 1;
      const percentage = Math.round((spent / limit) * 100);
      const remaining = limit - spent;
      const dailyAllowance = Math.max(0, Math.floor(remaining / remainingDays));

      let status: 'safe' | 'warning' | 'critical' | 'exceeded' = 'safe';
      if (percentage >= 100) {
        status = 'exceeded';
      } else if (percentage >= 85) {
        status = 'critical';
      } else if (percentage >= 65) {
        status = 'warning';
      }

      // Hitung progress per sub-kategori yang terdefinisi atau yang memiliki transaksi
      const activeSubMap = subcategoryExpenseMap[b.category] || {};
      const definedSubList = b.subcategories || [];
      const subMapKeys = Object.keys(activeSubMap);

      // Kumpulkan semua nama subkategori unik (dari budget setup + dari real expenses)
      const allSubNames = Array.from(new Set([...definedSubList.map((s) => s.name), ...subMapKeys]));

      const subcategoryItems = allSubNames.map((subName) => {
        const subConfig = definedSubList.find((s) => s.name.toLowerCase() === subName.toLowerCase());
        const subSpent = activeSubMap[subName] || 0;
        const subLimit = subConfig?.limit || 0;
        const subPercentage = subLimit > 0 ? Math.round((subSpent / subLimit) * 100) : 0;
        const subRemaining = subLimit > 0 ? subLimit - subSpent : -subSpent;

        return {
          id: subConfig?.id || `sub-dyn-${subName}`,
          name: subName,
          limit: subLimit,
          spent: subSpent,
          percentage: subPercentage,
          remaining: subRemaining,
          isConfigured: !!subConfig && subLimit > 0,
        };
      });

      return {
        ...b,
        spent,
        limit,
        percentage,
        remaining,
        dailyAllowance,
        status,
        subcategoryItems,
      };
    });

    const sumItemsLimit = items.reduce((sum, i) => sum + i.limit, 0);
    const totalBudget = customOverallBudget !== null && customOverallBudget > 0
      ? customOverallBudget
      : sumItemsLimit;

    const totalSpentInBudget = items.reduce((sum, i) => sum + i.spent, 0);
    const overallPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpentInBudget / totalBudget) * 100)) : 0;
    const overallRemaining = totalBudget - totalSpentInBudget;

    return {
      items,
      totalBudget,
      sumItemsLimit,
      isCustomCapacity: customOverallBudget !== null && customOverallBudget > 0,
      totalSpentInBudget,
      overallPercentage,
      overallRemaining,
      remainingDays,
      totalDaysInMonth,
      currentDay,
    };
  }, [budgets, transactions, customOverallBudget]);

  // Helper when opening Add Modal
  const handleOpenAddModal = (type: 'income' | 'expense') => {
    setAddModalType(type);
    const availableCategories = type === 'income' ? incomeCategories : expenseCategories;
    const initialCat = availableCategories[0] || '';
    setFormCategory(initialCat);
    const defaultSubs = categorySubcategories[initialCat] || [];
    setFormSubcategory(defaultSubs[0] || '');
    setTransactionError(null);
    setShowAddModal(true);
  };

  // Helper to ensure user has a valid wallet_id in Supabase wallets table
  const getOrCreateUserWalletId = async (uid: string): Promise<string | null> => {
    try {
      const { data: userWallets } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', uid)
        .limit(1);

      if (userWallets && userWallets.length > 0) {
        return userWallets[0].id;
      }

      const { data: newWallet, error: createWalletErr } = await supabase
        .from('wallets')
        .insert([
          {
            user_id: uid,
            name: 'Dompet Utama',
            type: 'cash',
            balance: 0,
            color: '#10B981',
            icon: 'wallet',
            is_active: true,
          },
        ])
        .select('id')
        .single();

      if (createWalletErr) {
        console.warn('Auto create wallet error:', createWalletErr);
      }
      return newWallet?.id || null;
    } catch (err) {
      console.warn('Error resolving wallet_id:', err);
      return null;
    }
  };

  // Helper to get or create a valid category_id if transactions table mandates category_id
  const getOrCreateCategoryId = async (
    uid: string,
    type: 'income' | 'expense',
    catName: string
  ): Promise<string | null> => {
    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('name', catName)
        .limit(1);

      if (existing && existing.length > 0) {
        return existing[0].id;
      }

      const { data: anyCat } = await supabase
        .from('categories')
        .select('id')
        .eq('type', type)
        .limit(1);

      if (anyCat && anyCat.length > 0) {
        return anyCat[0].id;
      }

      const { data: newCat } = await supabase
        .from('categories')
        .insert([
          {
            user_id: uid,
            name: catName,
            type: type,
            color: type === 'income' ? '#10B981' : '#EF4444',
            icon: 'tag',
          },
        ])
        .select('id')
        .single();

      return newCat?.id || null;
    } catch {
      return null;
    }
  };

  // Transaction Add Handler - Simpan Instan Optimistik & Sync Supabase di Background (Super Cepat)
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransactionError(null);

    const parsedAmount = parseInt(formAmount.replace(/\D/g, ''), 10);
    if (!formTitle.trim()) {
      setTransactionError('Nama transaksi wajib diisi.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransactionError('Nominal transaksi harus lebih dari 0.');
      return;
    }

    const currentUserId = session?.user?.id || 'guest';
    const finalCategory =
      formCategory.trim() || (addModalType === 'income' ? 'Pemasukan' : 'Pengeluaran');
    const finalSubcategory = addModalType === 'expense' ? formSubcategory.trim() : '';
    const transactionDate = formDate || new Date().toISOString().split('T')[0];
    const txName = formTitle.trim();

    let transactionNotes = formNotes.trim() || null;
    if (finalSubcategory) {
      transactionNotes = transactionNotes
        ? `[Sub: ${finalSubcategory}] ${transactionNotes}`
        : `[Sub: ${finalSubcategory}]`;
    }

    // ID unik lokal untuk simpan instan
    const tempId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newTx: TransactionItem = {
      id: tempId,
      type: addModalType,
      title: txName,
      description: txName,
      category: finalCategory,
      subCategory: finalSubcategory || undefined,
      amount: parsedAmount,
      date: transactionDate,
      notes: formNotes.trim() || undefined,
    };

    // 1. UPDATE STATE & LOCAL STORAGE INSTAN SANGAT CEPAT (0 DELAY)
    setTransactions((prev) => [newTx, ...prev]);

    if (addModalType === 'income') {
      if (!incomeCategories.includes(finalCategory)) {
        setIncomeCategories((prev) => [...prev, finalCategory]);
      }
    } else {
      if (!expenseCategories.includes(finalCategory)) {
        setExpenseCategories((prev) => [...prev, finalCategory]);
      }
      if (finalSubcategory && finalCategory) {
        const currentSubs = categorySubcategories[finalCategory] || [];
        if (!currentSubs.includes(finalSubcategory)) {
          setCategorySubcategories((prev) => ({
            ...prev,
            [finalCategory]: [...(prev[finalCategory] || []), finalSubcategory],
          }));
        }
      }
    }

    // Reset Form Input & Tutup Modal Langsung
    setFormTitle('');
    setFormAmount('');
    setFormNotes('');
    setFormCategory('');
    setFormSubcategory('');
    setShowAddModal(false);

    // Audio & Toast Berhasil Instant
    if (addModalType === 'income') {
      soundService.playIncomeSuccess();
    } else {
      soundService.playExpenseSuccess();
    }
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);

    // 2. PROSES SINKRONISASI KE SUPABASE SECARA BACKGROUND (TANPA MENGHAMBAT UI)
    if (currentUserId && currentUserId !== 'guest') {
      (async () => {
        try {
          const resolvedWalletId = await getOrCreateUserWalletId(currentUserId);
          const resolvedCatId = await getOrCreateCategoryId(currentUserId, addModalType, finalCategory);

          const insertPayload: Record<string, any> = {
            user_id: currentUserId,
            description: txName,
            amount: parsedAmount,
            type: addModalType,
            category: finalCategory,
            date: transactionDate,
            notes: transactionNotes,
          };

          if (finalSubcategory) {
            insertPayload.sub_category = finalSubcategory;
          }
          if (resolvedWalletId) {
            insertPayload.wallet_id = resolvedWalletId;
          }
          if (resolvedCatId) {
            insertPayload.category_id = resolvedCatId;
          }

          const insertPromise = supabase
            .from('transactions')
            .insert([insertPayload])
            .select()
            .single();

          const timeoutPromise = new Promise<any>((resolve) =>
            setTimeout(() => resolve({ error: { message: 'Timeout background sync' } }), 4000)
          );

          let insertResult: any = await Promise.race([insertPromise, timeoutPromise]);

          if (insertResult.error && insertResult.error.code === 'PGRST204') {
            const errorMsgLower = (insertResult.error.message || '').toLowerCase();
            if (errorMsgLower.includes('description')) {
              const payloadTitle: Record<string, any> = { ...insertPayload, title: txName };
              delete payloadTitle.description;
              insertResult = await supabase
                .from('transactions')
                .insert([payloadTitle])
                .select()
                .single();
            }
          }

          if (insertResult.data?.id) {
            const realId = String(insertResult.data.id);
            setTransactions((prev) =>
              prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t))
            );
          }
        } catch (err) {
          console.warn('Background sync transaction to Supabase warning:', err);
        }
      })();
    }
  };

  // Transaction Edit Handlers - Simpan Instan & Sync Supabase di Background
  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const currentUserId = session?.user?.id;
    const trimmedCat =
      editingTransaction.category.trim() ||
      (editingTransaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran');
    const trimmedSubcat =
      editingTransaction.type === 'expense' ? editingTransaction.subCategory?.trim() : '';

    let updatedNotes = editingTransaction.notes?.trim() || null;
    if (trimmedSubcat) {
      const cleanNotes = updatedNotes ? updatedNotes.replace(/\[Sub:\s*[^\]]+\]/i, '').trim() : '';
      updatedNotes = cleanNotes ? `[Sub: ${trimmedSubcat}] ${cleanNotes}` : `[Sub: ${trimmedSubcat}]`;
    }

    const updatedTx: TransactionItem = {
      ...editingTransaction,
      category: trimmedCat,
      subCategory: trimmedSubcat || undefined,
      notes: editingTransaction.notes?.trim() || undefined,
    };

    // Update state & storage instan
    setTransactions((prev) =>
      prev.map((t) => (t.id === updatedTx.id ? updatedTx : t))
    );
    setEditingTransaction(null);
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);

    // Sync Supabase di background
    if (currentUserId && currentUserId !== 'guest') {
      (async () => {
        try {
          const updatePayload: Record<string, any> = {
            description: editingTransaction.title.trim(),
            amount: editingTransaction.amount,
            type: editingTransaction.type,
            category: trimmedCat,
            date: editingTransaction.date,
            notes: updatedNotes,
            updated_at: new Date().toISOString(),
          };

          if (trimmedSubcat) {
            updatePayload.sub_category = trimmedSubcat;
          }

          await supabase
            .from('transactions')
            .update(updatePayload)
            .eq('id', editingTransaction.id)
            .eq('user_id', currentUserId);
        } catch (err) {
          console.warn('Background update transaction warning:', err);
        }
      })();
    }
  };

  // Transaction Delete Handler - Simpan Instan & Sync Supabase di Background
  const handleDeleteTransaction = async (id: string) => {
    const currentUserId = session?.user?.id;

    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      return;
    }

    // Update state & storage instan
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (editingTransaction?.id === id) {
      setEditingTransaction(null);
    }
    soundService.playDelete();
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);

    // Sync Supabase di background
    if (currentUserId && currentUserId !== 'guest') {
      (async () => {
        try {
          await supabase
            .from('transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUserId);
        } catch (err) {
          console.warn('Background delete transaction warning:', err);
        }
      })();
    }
  };

  // Deposit to Savings Goal - Catat juga ke Supabase Database
  const handleDepositToGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(depositAmount.replace(/\D/g, ''), 10);
    if (!depositGoalId || isNaN(amountNum) || amountNum <= 0) return;

    const currentUserId = session?.user?.id;
    const targetGoal = savingsGoals.find((g) => g.id === depositGoalId);

    if (currentUserId && targetGoal) {
      try {
        const goalDesc = `Tabungan: ${targetGoal.title}`;
        const resolvedWalletId = await getOrCreateUserWalletId(currentUserId);
        const resolvedCatId = await getOrCreateCategoryId(currentUserId, 'expense', 'Tabungan');

        const payload: Record<string, any> = {
          user_id: currentUserId,
          description: goalDesc,
          type: 'expense',
          category: 'Tabungan',
          amount: amountNum,
          date: new Date().toISOString().split('T')[0],
          notes: `Alokasi target ${targetGoal.title}`,
        };

        if (resolvedWalletId) {
          payload.wallet_id = resolvedWalletId;
        }
        if (resolvedCatId) {
          payload.category_id = resolvedCatId;
        }

        let insertRes = await supabase.from('transactions').insert([payload]).select().single();

        if (insertRes.error && insertRes.error.code === 'PGRST204') {
          const errMsgLower = (insertRes.error.message || '').toLowerCase();
          if (errMsgLower.includes('description')) {
            const payloadTitle: Record<string, any> = { ...payload, title: goalDesc };
            delete payloadTitle.description;
            insertRes = await supabase.from('transactions').insert([payloadTitle]).select().single();
          }
          if (
            insertRes.error &&
            insertRes.error.code === 'PGRST204' &&
            insertRes.error.message?.toLowerCase().includes('category')
          ) {
            const payloadNoCat = { ...payload };
            delete payloadNoCat.category;
            insertRes = await supabase.from('transactions').insert([payloadNoCat]).select().single();
          }
        }

        const { data, error } = insertRes;

        if (error) {
          console.error('Supabase insert savings expense error:', error);
        } else if (data) {
          setTransactions((prev) => [
            {
              id: String(data.id),
              type: 'expense',
              title: data.description || data.title || goalDesc,
              description: data.description || data.title || goalDesc,
              category: data.category || data.kategori || 'Tabungan',
              amount: Number(data.amount),
              date: String(data.date),
              notes: data.notes || undefined,
            },
            ...prev,
          ]);
        }
      } catch (err) {
        console.error('Error recording savings transaction to Supabase:', err);
      }
    }

    setSavingsGoals((prev) =>
      prev.map((goal) => {
        if (goal.id === depositGoalId) {
          return {
            ...goal,
            currentAmount: goal.currentAmount + amountNum,
          };
        }
        return goal;
      })
    );

    const willReachTarget = Boolean(
      targetGoal && targetGoal.targetAmount > 0 && targetGoal.currentAmount + amountNum >= targetGoal.targetAmount
    );

    setDepositGoalId(null);
    setDepositAmount('');

    if (willReachTarget) {
      soundService.playGoalCelebration();
    } else {
      soundService.playMultiCoin();
    }
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Category Management Handlers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (categoryModalTab === 'expense') {
      if (!expenseCategories.includes(trimmed)) {
        setExpenseCategories([...expenseCategories, trimmed]);
      }
    } else {
      if (!incomeCategories.includes(trimmed)) {
        setIncomeCategories([...incomeCategories, trimmed]);
      }
    }
    setNewCategoryName('');
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveEditCategory = (index: number) => {
    const trimmed = editingCategoryValue.trim();
    if (!trimmed) return;

    if (categoryModalTab === 'expense') {
      const oldVal = expenseCategories[index];
      const updated = [...expenseCategories];
      updated[index] = trimmed;
      setExpenseCategories(updated);
      setTransactions((prev) =>
        prev.map((t) => (t.category === oldVal ? { ...t, category: trimmed } : t))
      );
      if (formCategory === oldVal) setFormCategory(trimmed);
    } else {
      const oldVal = incomeCategories[index];
      const updated = [...incomeCategories];
      updated[index] = trimmed;
      setIncomeCategories(updated);
      setTransactions((prev) =>
        prev.map((t) => (t.category === oldVal ? { ...t, category: trimmed } : t))
      );
      if (formCategory === oldVal) setFormCategory(trimmed);
    }

    setEditingCategoryIndex(null);
    setEditingCategoryValue('');
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDeleteCategory = (index: number) => {
    if (categoryModalTab === 'expense') {
      setExpenseCategories(expenseCategories.filter((_, i) => i !== index));
    } else {
      setIncomeCategories(incomeCategories.filter((_, i) => i !== index));
    }
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Savings Goal Handlers
  const handleCreateSavingsGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = parseInt(newSavingsTarget.replace(/\D/g, ''), 10);
    const initialNum = newSavingsInitial ? parseInt(newSavingsInitial.replace(/\D/g, ''), 10) : 0;
    if (!newSavingsTitle.trim() || isNaN(targetNum) || targetNum <= 0) return;

    const colors = ['#DFB76C', '#38BDF8', '#A78BFA', '#34D399', '#F472B6', '#FBBF24'];
    const chosenColor = colors[savingsGoals.length % colors.length];

    const newGoal: SavingsGoal = {
      id: `sav-${Date.now()}`,
      title: newSavingsTitle.trim(),
      category: newSavingsCategory.trim() || 'Tabungan',
      targetAmount: targetNum,
      currentAmount: isNaN(initialNum) ? 0 : initialNum,
      targetDate: newSavingsDate.trim() || 'Fleksibel',
      color: chosenColor,
    };

    setSavingsGoals([...savingsGoals, newGoal]);
    setNewSavingsTitle('');
    setNewSavingsCategory('');
    setNewSavingsTarget('');
    setNewSavingsInitial('');
    setNewSavingsDate('');
    setShowAddSavingsModal(false);
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleUpdateSavingsGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;

    setSavingsGoals((prev) =>
      prev.map((g) => (g.id === editingGoal.id ? editingGoal : g))
    );
    setEditingGoal(null);
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDeleteSavingsGoal = (id: string) => {
    setSavingsGoals((prev) => prev.filter((g) => g.id !== id));
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Export Menu Popover States
  const [exportMenuOpenBeranda, setExportMenuOpenBeranda] = useState(false);
  const [exportMenuOpenTransaksi, setExportMenuOpenTransaksi] = useState(false);

  // Handler Ekspor Transaksi ke Excel (.xlsx) dengan format 2 kolom terpisah
  const handleExportExcel = () => {
    setExportMenuOpenBeranda(false);
    setExportMenuOpenTransaksi(false);
    if (transactions.length === 0) {
      setToastMessage('Belum ada transaksi');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }
    const success = exportTransactionsToExcel(transactions);
    if (success) {
      soundService.playIncomeSuccess();
      setToastMessage('Berhasil');
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Handler Ekspor Transaksi ke PDF (.pdf)
  const handleExportPdf = () => {
    setExportMenuOpenBeranda(false);
    setExportMenuOpenTransaksi(false);
    if (transactions.length === 0) {
      setToastMessage('Belum ada transaksi');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }
    const success = exportTransactionsToPdf(transactions);
    if (success) {
      soundService.playIncomeSuccess();
      setToastMessage('Berhasil');
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Budget Handlers (Tambah, Ubah Limit, Hapus)
  const handleOpenAddBudget = () => {
    // Pilih kategori pengeluaran pertama yang belum punya budget jika ada
    const existingCats = budgets.map((b) => b.category);
    const available = expenseCategories.find((c) => !existingCats.includes(c)) || expenseCategories[0] || 'Lainnya';
    setBudgetCategory(available);
    setBudgetLimit('1000000');
    
    // Siapkan subkategori default untuk kategori yang dipilih
    const subs = categorySubcategories[available] || [];
    setEditingBudgetSubcategories(
      subs.map((s, idx) => ({
        id: `sub-init-${Date.now()}-${idx}`,
        name: s,
        limit: 0,
      }))
    );

    setShowAddBudgetModal(true);
  };

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseInt(budgetLimit.replace(/\D/g, ''), 10);
    const catTrimmed = budgetCategory.trim();
    if (!catTrimmed || isNaN(limitNum) || limitNum <= 0) {
      setToastMessage('Kategori & Nominal harus diisi');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    if (!expenseCategories.includes(catTrimmed)) {
      setExpenseCategories((prev) => [...prev, catTrimmed]);
    }

    // Proteksi jika kapasitas master budget sedang diaktifkan
    if (budgetAnalytics.isCustomCapacity) {
      const otherTotal = budgets
        .filter((b) => b.category.toLowerCase() !== budgetCategory.toLowerCase())
        .reduce((sum, b) => sum + b.monthlyLimit, 0);
      const maxAllowed = Math.max(0, budgetAnalytics.totalBudget - otherTotal);

      if (limitNum > maxAllowed) {
        setToastMessage(`Maksimal ${formatRupiah(maxAllowed)}`);
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }
    }

    // Filter subcategories yang limitnya > 0 atau namanya diisi
    const cleanedSubcats = editingBudgetSubcategories
      .filter((s) => s.name.trim() !== '')
      .map((s) => ({ ...s, name: s.name.trim(), limit: Math.max(0, Number(s.limit) || 0) }));

    // Jika kategori sudah ada, update limit dan subcategories-nya
    const exists = budgets.find((b) => b.category.toLowerCase() === budgetCategory.toLowerCase());
    let targetBudgetItem: BudgetItem;

    if (exists) {
      targetBudgetItem = { ...exists, monthlyLimit: limitNum, subcategories: cleanedSubcats };
      setBudgets((prev) =>
        prev.map((b) =>
          b.id === exists.id
            ? targetBudgetItem
            : b
        )
      );
    } else {
      const colors = ['#EF4444', '#38BDF8', '#DFB76C', '#A78BFA', '#F59E0B', '#10B981', '#EC4899'];
      const chosenColor = colors[budgets.length % colors.length];
      targetBudgetItem = {
        id: `bdg-${Date.now()}`,
        category: budgetCategory,
        monthlyLimit: limitNum,
        color: chosenColor,
        subcategories: cleanedSubcats,
      };
      setBudgets([...budgets, targetBudgetItem]);
    }

    // Sinkronisasi otomatis ke Supabase Database
    syncBudgetToSupabase(userId, targetBudgetItem).then((res) => {
      if (res.success) setBudgetSyncStatus('synced');
    });

    // Pastikan akordeon kategori ini terbuka
    if (exists) {
      setExpandedBudgets((prev) => ({ ...prev, [exists.id]: true }));
    }

    setShowAddBudgetModal(false);
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleUpdateBudgetLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;
    const limitNum = parseInt(budgetLimit.replace(/\D/g, ''), 10);
    if (isNaN(limitNum) || limitNum <= 0) {
      setToastMessage('Nominal harus > 0');
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    // Proteksi jika kapasitas master budget sedang diaktifkan
    if (budgetAnalytics.isCustomCapacity) {
      const otherTotal = budgets
        .filter((b) => b.id !== editingBudget.id)
        .reduce((sum, b) => sum + b.monthlyLimit, 0);
      const maxAllowed = Math.max(0, budgetAnalytics.totalBudget - otherTotal);

      if (limitNum > maxAllowed) {
        setToastMessage(`Maksimal ${formatRupiah(maxAllowed)}`);
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }
    }

    const cleanedSubcats = editingBudgetSubcategories
      .filter((s) => s.name.trim() !== '')
      .map((s) => ({ ...s, name: s.name.trim(), limit: Math.max(0, Number(s.limit) || 0) }));

    const updatedBudget: BudgetItem = {
      ...editingBudget,
      monthlyLimit: limitNum,
      subcategories: cleanedSubcats,
    };

    setBudgets((prev) =>
      prev.map((b) =>
        b.id === editingBudget.id
          ? updatedBudget
          : b
      )
    );

    // Sinkronisasi update ke Supabase
    syncBudgetToSupabase(userId, updatedBudget).then((res) => {
      if (res.success) setBudgetSyncStatus('synced');
    });

    setEditingBudget(null);
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDeleteBudget = (id: string) => {
    const itemToDelete = budgets.find((b) => b.id === id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    if (itemToDelete) {
      deleteBudgetFromSupabase(userId, itemToDelete.category);
    }
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Handler Edit Kapasitas Total Budget Bulanan
  const handleOpenEditCapacity = () => {
    setCapacityInput(budgetAnalytics.totalBudget > 0 ? budgetAnalytics.totalBudget.toString() : '');
    setShowEditCapacityModal(true);
  };

  const handleSaveBudgetCapacity = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(capacityInput.replace(/\D/g, ''), 10);
    if (isNaN(val) || val <= 0) return;

    setCustomOverallBudget(val);
    syncBudgetCapacityToSupabase(userId, val);
    setShowEditCapacityModal(false);
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleResetBudgetCapacityToSum = () => {
    setCustomOverallBudget(null);
    syncBudgetCapacityToSupabase(userId, null);
    setShowEditCapacityModal(false);
    setToastMessage('Berhasil');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Donut Circle Math
  const donutRadius = 54;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let accumulatedOffset = 0;

  const hoveredItem = donutData.find((d) => d.category === hoveredDonutSlice);

  return (
    <div className="min-h-screen w-full bg-[#070D1E] text-slate-100 flex justify-center selection:bg-[#DFB76C] selection:text-[#070D1E] relative">
      {/* Background Radial Ambient Glows */}
      <div className="pointer-events-none fixed -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[320px] bg-[#DFB76C]/5 blur-[120px] rounded-full" />
      <div className="pointer-events-none fixed -bottom-36 left-1/2 -translate-x-1/2 w-[450px] h-[300px] bg-blue-600/5 blur-[120px] rounded-full" />

      {/* Mobile Shell Wrapper */}
      <div className="w-full max-w-md min-h-screen bg-[#070D1E] border-x border-white/[0.08] shadow-2xl flex flex-col relative pb-24">
        {/* Top Header Gold Accent Line */}
        <div className="fixed top-0 max-w-md w-full h-[2px] bg-gradient-to-r from-transparent via-[#DFB76C] to-transparent z-40" />

        {/* TOP BAR / HEADER (DENGAN FOTO PROFIL MANUAL & INTERAKTIF) */}
        <header className="sticky top-0 z-30 bg-[#070D1E]/90 backdrop-blur-xl border-b border-white/[0.08] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Foto Profil Interaktif (Bisa Diklik untuk Ganti Foto) */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="relative group cursor-pointer focus:outline-none"
              title="Klik untuk ubah foto profil"
            >
              {userAvatar ? (
                <div className="w-10 h-10 rounded-2xl overflow-hidden border border-[#DFB76C]/60 shadow-lg shadow-black/40 group-hover:scale-105 group-hover:border-[#DFB76C] transition-all duration-300">
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#121E3D] to-[#070D1E] border border-[#DFB76C]/40 flex items-center justify-center shadow-lg shadow-black/40 group-hover:scale-105 group-hover:border-[#DFB76C] transition-all duration-300">
                  <span className="text-base font-black font-num text-[#DFB76C]">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Badge Ikon Kamera Interaktif */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#DFB76C] text-[#070D1E] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Camera size={10} strokeWidth={2.5} />
              </div>
            </button>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black tracking-wider uppercase font-num text-white">
                  MYDOMPET
                </h1>
                <span className="text-[10px] text-slate-400 font-medium">
                  by <span className="text-[#DFB76C] font-semibold">Firmansah</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                Halo, <span className="text-slate-200 font-semibold">{userName}</span>
              </p>
            </div>
          </div>

          {/* Header Actions: Logout */}
          <div className="flex items-center gap-2">
            {/* Tombol Keluar Akun */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 text-slate-400 hover:text-red-400 transition-all text-xs font-semibold cursor-pointer disabled:opacity-50 group"
              title="Keluar dari Akun"
            >
              {isLoggingOut ? (
                <Loader2 size={14} className="animate-spin text-slate-300" />
              ) : (
                <>
                  <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
                  <span>Keluar</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* MAIN BODY CONTENT */}
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* ========================================================
              TAB 1: BERANDA
              (Warna Klasik Navy & Gold, Font Angka Outfit Jelas,
               Gerakan Ikon Interaktif)
             ======================================================== */}
          {activeTab === 'beranda' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* 1. Saldo Utama Card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121E3D] via-[#0D162E] to-[#080E1E] border border-[#DFB76C]/30 p-5 shadow-xl shadow-black/50 group">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-slate-300">
                    <div className="p-1 rounded-lg bg-[#DFB76C]/15 text-[#DFB76C] animate-icon-float">
                      <Wallet size={14} />
                    </div>
                    Total Saldo Kas
                  </span>
                  <span className="text-[10px] font-bold text-[#DFB76C] bg-[#DFB76C]/10 border border-[#DFB76C]/20 px-2 py-0.5 rounded-full font-num">
                    IDR
                  </span>
                </div>

                {/* Angka Saldo Utama - Font Angka Lebih Jelas & Tebal */}
                <div className="my-2.5">
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-num tracking-tight tabular-nums">
                    {formatRupiah(currentBalance)}
                  </h2>
                </div>

                {/* 2. Pemasukan, Pengeluaran & Tabungan Row */}
                <div className="grid grid-cols-3 pt-3 border-t border-white/[0.08] gap-2">
                  {/* Pemasukan */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium tracking-wider flex items-center gap-1">
                      <ArrowDownLeft size={12} className="text-[#E5C365] animate-icon-pulse" />
                      Masuk
                    </span>
                    <span className="font-extrabold text-[#E5C365] font-num text-xs sm:text-sm truncate block tracking-tight">
                      +{formatRupiah(totalIncome)}
                    </span>
                  </div>

                  {/* Pengeluaran */}
                  <div className="space-y-1 border-x border-white/[0.08] px-2">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium tracking-wider flex items-center gap-1">
                      <ArrowUpRight size={12} className="text-red-400 animate-icon-pulse" />
                      Keluar
                    </span>
                    <span className="font-extrabold text-red-400 font-num text-xs sm:text-sm truncate block tracking-tight">
                      -{formatRupiah(totalExpense)}
                    </span>
                  </div>

                  {/* Tabungan */}
                  <div className="space-y-1 pl-1">
                    <span className="text-[9px] text-slate-400 block uppercase font-medium tracking-wider flex items-center gap-1">
                      <Wallet size={12} className="text-sky-400 animate-icon-wiggle" />
                      Tabungan
                    </span>
                    <span className="font-extrabold text-sky-400 font-num text-xs sm:text-sm truncate block tracking-tight">
                      {formatRupiah(totalSavings)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Tombol Cepat: Catat Pemasukan & Catat Pengeluaran (Ukuran Disesuaikan Ciamik & Ringkas) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOpenAddModal('income')}
                  className="p-2.5 rounded-2xl bg-gradient-to-r from-[#DFB76C]/15 to-[#DFB76C]/5 border border-[#DFB76C]/30 hover:border-[#DFB76C]/70 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2.5 text-left group cursor-pointer shadow-md shadow-black/20"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#DFB76C] text-[#080E1E] flex items-center justify-center font-bold shadow-md shadow-[#DFB76C]/25 group-hover:rotate-90 group-hover:scale-105 transition-all duration-300 shrink-0">
                    <Plus size={16} strokeWidth={2.8} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block group-hover:text-[#DFB76C] transition-colors leading-tight">
                      Catat Pemasukan
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddModal('expense')}
                  className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-red-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2.5 text-left group cursor-pointer shadow-md shadow-black/20"
                >
                  <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105 transition-all duration-300 shrink-0">
                    <ArrowUpRight size={16} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block group-hover:text-red-400 transition-colors leading-tight">
                      Catat Pengeluaran
                    </span>
                  </div>
                </button>
              </div>

              {/* 4. DIAGRAM DONAT (Donut Chart - Ukuran Kompak & Proporsional) */}
              <div className="rounded-3xl bg-[#0B1326] border border-white/[0.08] p-4 sm:p-5 shadow-xl space-y-3">
                {/* Header Donut Chart, Export Excel di Pojok Kanan & Toggle Type di Bawahnya */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 group pt-0.5">
                    <div className="w-7 h-7 rounded-xl bg-[#DFB76C]/15 border border-[#DFB76C]/25 text-[#DFB76C] flex items-center justify-center group-hover:rotate-45 transition-transform duration-500 shrink-0">
                      <PieIcon size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        Diagram Alokasi
                      </h3>
                    </div>
                  </div>

                  {/* Sisi Kanan: Tombol Ekspor di Pojok Kanan Atas, lalu di bawahnya Toggle Pengeluaran / Pemasukan */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Tombol Ekspor Single Icon dengan Pilihan PDF / Excel */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setExportMenuOpenBeranda(!exportMenuOpenBeranda)}
                        className="p-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer flex items-center justify-center shadow-sm group hover:scale-105 active:scale-95"
                        title="Ekspor Transaksi"
                        aria-label="Ekspor Transaksi"
                      >
                        <Download size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                      </button>

                      {exportMenuOpenBeranda && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setExportMenuOpenBeranda(false)}
                          />
                          <div className="absolute right-0 top-9 z-50 rounded-2xl bg-[#0B1426] border border-white/15 shadow-2xl p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                            <button
                              type="button"
                              onClick={handleExportPdf}
                              className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer group hover:scale-105 active:scale-95"
                              title="Ekspor PDF"
                            >
                              <FileText size={15} className="group-hover:scale-110 transition-transform" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleExportExcel}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer group hover:scale-105 active:scale-95"
                              title="Ekspor Excel"
                            >
                              <FileSpreadsheet size={15} className="group-hover:scale-110 transition-transform" />
                              <span>Excel</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Toggle Pengeluaran / Pemasukan di Bawahnya */}
                    <div className="flex items-center p-0.5 rounded-xl bg-[#050B17] border border-white/10 text-[10px] font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setDonutType('expense');
                          setHoveredDonutSlice(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          donutType === 'expense'
                            ? 'bg-red-500/80 text-white font-bold shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Pengeluaran
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDonutType('income');
                          setHoveredDonutSlice(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          donutType === 'income'
                            ? 'bg-[#DFB76C] text-[#080E1E] font-bold shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Pemasukan
                      </button>
                    </div>
                  </div>
                </div>

                {/* Donut SVG Rendering (Ukuran Disesuaikan Lebih Proporsional) */}
                {donutData.length === 0 ? (
                  <div className="py-6 text-center space-y-2 px-4 rounded-2xl bg-[#050B17]/60 border border-white/5">
                    <PieIcon size={28} className="mx-auto text-slate-600 animate-icon-pulse" />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">
                        Belum ada transaksi {donutType === 'expense' ? 'pengeluaran' : 'pemasukan'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Mulai catat transaksi untuk melihat diagram alokasi otomatis
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(donutType)}
                      className="px-3 py-1.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus size={13} strokeWidth={2.5} />
                      <span>Catat {donutType === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative flex items-center justify-center py-1">
                      <svg
                        className="w-36 h-36 sm:w-40 sm:h-40 -rotate-90 transform"
                        viewBox="0 0 140 140"
                      >
                        {/* Background track circle */}
                        <circle
                          cx="70"
                          cy="70"
                          r={donutRadius}
                          fill="transparent"
                          stroke="rgba(255, 255, 255, 0.05)"
                          strokeWidth="14"
                        />

                        {/* Donut Segments */}
                        {donutData.map((item) => {
                          const segmentLength = (item.percentage / 100) * donutCircumference;
                          const currentOffset = accumulatedOffset;
                          accumulatedOffset += segmentLength;

                          const isHovered = hoveredDonutSlice === item.category;

                          return (
                            <circle
                              key={item.category}
                              cx="70"
                              cy="70"
                              r={donutRadius}
                              fill="transparent"
                              stroke={item.color}
                              strokeWidth={isHovered ? 18 : 14}
                              strokeDasharray={`${segmentLength} ${donutCircumference - segmentLength}`}
                              strokeDashoffset={-currentOffset}
                              strokeLinecap="round"
                              className="transition-all duration-300 cursor-pointer"
                              onMouseEnter={() => setHoveredDonutSlice(item.category)}
                              onMouseLeave={() => setHoveredDonutSlice(null)}
                              onClick={() =>
                                setHoveredDonutSlice(
                                  hoveredDonutSlice === item.category ? null : item.category
                                )
                              }
                            />
                          );
                        })}
                      </svg>

                      {/* Donut Center Display */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
                        {hoveredItem ? (
                          <div className="animate-in fade-in zoom-in-95 duration-150">
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider block"
                              style={{ color: hoveredItem.color }}
                            >
                              {hoveredItem.category}
                            </span>
                            <span className="text-xs font-black font-num text-white block mt-0.5 tracking-tight">
                              {formatRupiah(hoveredItem.amount)}
                            </span>
                            <span className="text-[9px] text-slate-400 font-num font-bold">
                              {hoveredItem.percentage.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-medium">
                              Total {donutType === 'expense' ? 'Keluar' : 'Masuk'}
                            </span>
                            <span className="text-xs font-black font-num text-white block mt-0.5 tracking-tight">
                              {formatRupiah(totalDonutAmount)}
                            </span>
                            <span className="text-[8px] text-slate-500 font-num">
                              {donutData.length} Kategori
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Donut Legend Items List (Kompak & Rapi) */}
                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/[0.06]">
                      {donutData.map((item) => (
                        <div
                          key={item.category}
                          onMouseEnter={() => setHoveredDonutSlice(item.category)}
                          onMouseLeave={() => setHoveredDonutSlice(null)}
                          onClick={() =>
                            setHoveredDonutSlice(
                              hoveredDonutSlice === item.category ? null : item.category
                            )
                          }
                          className={`p-1.5 rounded-xl transition-all cursor-pointer border ${
                            hoveredDonutSlice === item.category
                              ? 'bg-white/10 border-white/20 scale-[1.02]'
                              : 'bg-[#050B17] border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-[10px] font-semibold text-white truncate">
                              {item.category}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-num">
                            <span className="text-slate-300 truncate font-bold text-[10px]">
                              {formatRupiah(item.amount)}
                            </span>
                            <span className="text-slate-400 ml-1 font-bold text-[9px]">
                              {item.percentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ringkasan Ringkas: Alokasi Budget Bulan Ini (Hanya Nominal & Persentase) */}
              <div
                onClick={() => setActiveTab('anggaran')}
                className="rounded-3xl bg-[#0B1326] border border-white/[0.08] p-5 shadow-xl space-y-3 cursor-pointer hover:border-[#DFB76C]/30 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#DFB76C]/15 border border-[#DFB76C]/25 text-[#DFB76C] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Target size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-[#DFB76C] transition-colors">
                        Alokasi Budget Bulan Ini
                      </h3>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-[#DFB76C] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Detail</span>
                    <ArrowUpRight size={13} />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#050B17] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-num">
                    <span className="text-slate-300 font-semibold">Total Terpakai:</span>
                    <span className="text-white font-bold">
                      {formatRupiah(budgetAnalytics.totalSpentInBudget)}{' '}
                      <span className="text-slate-400 font-normal">
                        / {formatRupiah(budgetAnalytics.totalBudget)}
                      </span>
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5 p-0.5 flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        budgetAnalytics.overallPercentage >= 100
                          ? 'bg-red-500'
                          : budgetAnalytics.overallPercentage >= 85
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, budgetAnalytics.overallPercentage)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-num text-slate-400">
                    <span className="font-bold text-slate-300">{budgetAnalytics.overallPercentage}% terpakai</span>
                    <span className={budgetAnalytics.overallRemaining < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {budgetAnalytics.overallRemaining >= 0
                        ? `Sisa ${formatRupiah(budgetAnalytics.overallRemaining)}`
                        : `Over ${formatRupiah(Math.abs(budgetAnalytics.overallRemaining))}`}
                    </span>
                  </div>
                </div>
              </div>


            </div>
          )}

          {/* ========================================================
              TAB 2: TRANSAKSI (FONT ANGKA SANGAT JELAS & TEGAS)
             ======================================================== */}
          {activeTab === 'transaksi' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Header Title, Kelola Kategori & Catat Baru Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Transaksi Keuangan</h2>
                  <p className="text-[11px] text-slate-400">Atur dan kelola riwayat arus kas Anda</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tombol Kelola Kategori Manual */}
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer font-semibold group"
                    title="Kelola Kategori Manual"
                  >
                    <Settings size={14} className="text-[#DFB76C] group-hover:rotate-90 transition-transform duration-300" />
                    <span className="hidden sm:inline">Kategori</span>
                  </button>

                  <button
                    onClick={() => handleOpenAddModal('expense')}
                    className="px-3.5 py-2 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs flex items-center gap-1.5 hover:brightness-105 active:scale-95 transition-all shadow-md shadow-[#DFB76C]/20 cursor-pointer group"
                  >
                    <Plus size={15} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-200" />
                    <span>Catat Baru</span>
                  </button>
                </div>
              </div>

              {/* Filter Tabs (Semua, Pemasukan, Pengeluaran) */}
              <div className="grid grid-cols-3 p-1 bg-[#050B17] rounded-2xl border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setTrxFilter('all')}
                  className={`py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    trxFilter === 'all'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Semua ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTrxFilter('income')}
                  className={`py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    trxFilter === 'income'
                      ? 'bg-[#DFB76C] text-[#080E1E] font-bold shadow-sm'
                      : 'text-slate-400 hover:text-[#DFB76C]'
                  }`}
                >
                  Pemasukan
                </button>
                <button
                  type="button"
                  onClick={() => setTrxFilter('expense')}
                  className={`py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    trxFilter === 'expense'
                      ? 'bg-red-500/80 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-red-400'
                  }`}
                >
                  Pengeluaran
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari transaksi atau kategori..."
                  className="w-full bg-[#050B17] border border-white/10 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Summary Chips - Font Angka Jelas & Elegan */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Masuk</span>
                  <span className="font-num font-black text-xs sm:text-sm text-[#E5C365] tracking-tight">
                    +{formatRupiah(totalIncome)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Keluar</span>
                  <span className="font-num font-black text-xs sm:text-sm text-red-400 tracking-tight">
                    -{formatRupiah(totalExpense)}
                  </span>
                </div>
              </div>

              {/* Transaction List */}
              <div className="space-y-2 pb-16">
                {isLoadingTransactions ? (
                  <div className="text-center py-12 space-y-3 rounded-2xl bg-[#050B17] border border-white/5 px-4">
                    <Loader2 size={28} className="mx-auto text-[#DFB76C] animate-spin" />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">Memuat data transaksi dari Supabase Database...</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Menghubungkan ke tabel public.transactions
                      </p>
                    </div>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-12 space-y-3 rounded-2xl bg-[#050B17] border border-white/5 px-4">
                    <Receipt size={32} className="mx-auto text-slate-600 animate-icon-pulse" />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">Belum ada data transaksi</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Semua transaksi pemasukan & pengeluaran akan tercatat rapi di sini
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenAddModal('expense')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#DFB76C] text-[#080E1E] text-xs font-bold hover:brightness-105 transition-all cursor-pointer shadow-sm"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      <span>Catat Transaksi Pertama</span>
                    </button>
                  </div>
                ) : (
                  filteredTransactions.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-[#080E1E] border border-white/[0.06] flex items-center justify-between hover:border-white/15 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                            item.type === 'income'
                              ? 'bg-[#DFB76C]/15 text-[#DFB76C] border border-[#DFB76C]/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {item.type === 'income' ? (
                            <ArrowDownLeft size={17} className="group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
                          ) : (
                            <ArrowUpRight size={17} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[#DFB76C] font-medium">{item.category}</span>
                            {item.subCategory && (
                              <span className="px-1.5 py-0.2 rounded-md bg-white/[0.06] text-slate-300 font-medium text-[9px] border border-white/10 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-[#DFB76C]" />
                                {item.subCategory}
                              </span>
                            )}
                            <span>&bull;</span>
                            <span className="font-num">{item.date}</span>
                          </p>
                          {item.notes && (
                            <p className="text-[10px] text-slate-500 italic truncate mt-0.5">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Amount Display & Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <div className="text-right">
                          <span
                            className={`text-xs sm:text-sm font-black font-num block tracking-tight ${
                              item.type === 'income' ? 'text-[#E5C365]' : 'text-red-400'
                            }`}
                          >
                            {item.type === 'income' ? '+' : '-'}
                            {formatRupiah(item.amount)}
                          </span>
                        </div>

                        {/* Tombol Edit Transaksi */}
                        <button
                          type="button"
                          onClick={() => setEditingTransaction({ ...item })}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-[#DFB76C]/20 text-slate-400 hover:text-[#DFB76C] hover:scale-110 active:scale-95 transition-all cursor-pointer"
                          title="Edit Transaksi ini"
                        >
                          <Pencil size={12} />
                        </button>

                        {/* Tombol Hapus Transaksi */}
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(item.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                          title="Hapus Transaksi"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Floating Action Button (FAB) Single Icon Ekspor di Pojok Kanan Bawah */}
              <div className="fixed bottom-[92px] left-0 right-0 z-30 flex justify-end pointer-events-none px-4 max-w-md mx-auto">
                <div className="relative pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setExportMenuOpenTransaksi(!exportMenuOpenTransaksi)}
                    className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-2xl shadow-emerald-950/80 border border-emerald-400/50 hover:scale-110 active:scale-90 transition-all cursor-pointer backdrop-blur-md flex items-center justify-center animate-in zoom-in-90 duration-300 group"
                    title="Ekspor Transaksi"
                    aria-label="Ekspor Transaksi"
                  >
                    <Download size={20} className="text-white group-hover:scale-110 transition-transform duration-300" />
                  </button>

                  {exportMenuOpenTransaksi && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setExportMenuOpenTransaksi(false)}
                      />
                      <div className="absolute right-0 bottom-15 z-50 rounded-2xl bg-[#0B1426] border border-white/15 shadow-2xl p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={handleExportPdf}
                          className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer group hover:scale-105 active:scale-95"
                          title="Ekspor PDF"
                        >
                          <FileText size={16} className="group-hover:scale-110 transition-transform" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportExcel}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer group hover:scale-105 active:scale-95"
                          title="Ekspor Excel"
                        >
                          <FileSpreadsheet size={16} className="group-hover:scale-110 transition-transform" />
                          <span>Excel</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: TABUNGAN (IKON DOMPET, ANIMASI HALUS & ANGKA JELAS)
             ======================================================== */}
          {activeTab === 'tabungan' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Tabungan Header Card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121E3D] via-[#0D162E] to-[#080E1E] border border-[#DFB76C]/30 p-5 shadow-xl shadow-black/50 group">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-slate-300">
                    <div className="p-1 rounded-lg bg-sky-500/15 text-sky-400 animate-icon-wiggle">
                      <Wallet size={14} />
                    </div>
                    Total Tabungan Saya
                  </span>
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full font-num">
                    {savingsGoals.length} Target
                  </span>
                </div>

                <div className="my-2.5">
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-num tracking-tight tabular-nums">
                    {formatRupiah(totalSavings)}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Disimpan aman untuk kebutuhan dan impian Anda
                  </p>
                </div>

                <div className="pt-3 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/[0.08]">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Sparkles size={12} className="text-[#DFB76C] animate-icon-pulse" />
                    <span>Target tabungan dapat diatur bebas</span>
                  </span>
                  <button
                    onClick={() => setShowAddSavingsModal(true)}
                    className="text-xs font-bold text-[#DFB76C] hover:underline flex items-center gap-1 cursor-pointer group"
                  >
                    <Plus size={13} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-200" />
                    <span>Tambah Target</span>
                  </button>
                </div>
              </div>

              {/* Savings Goals List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Daftar Target & Pos Tabungan
                  </h3>
                  <button
                    onClick={() => setShowAddSavingsModal(true)}
                    className="text-xs font-semibold text-[#DFB76C] hover:underline flex items-center gap-1 cursor-pointer group"
                  >
                    <Plus size={12} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-200" />
                    <span>Target Baru</span>
                  </button>
                </div>

                {savingsGoals.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl bg-[#080E1E] border border-white/5 space-y-3 px-4">
                    <Wallet size={32} className="mx-auto text-slate-600 animate-icon-float" />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">Belum ada target tabungan</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tentukan target finansial impian atau pos tabungan Anda sekarang
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddSavingsModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      <span>Buat Target Impian</span>
                    </button>
                  </div>
                ) : (
                  savingsGoals.map((goal) => {
                    const progress = Math.min(
                      Math.round((goal.currentAmount / goal.targetAmount) * 100),
                      100
                    );
                    return (
                      <div
                        key={goal.id}
                        className="p-4 rounded-2xl bg-[#080E1E] border border-white/[0.06] space-y-3 hover:border-white/15 transition-all shadow-md group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            {/* Ikon Dompet dengan Animasi Lembut Saat Hover */}
                            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                              <Wallet size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-white">{goal.title}</h4>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-white/5 text-slate-300 border border-white/10">
                                  {goal.category}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Target: <span className="text-slate-300 font-medium font-num">{goal.targetDate}</span>
                              </p>
                            </div>
                          </div>

                          {/* Tombol Aksi: Edit, Hapus & Nabung */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingGoal({ ...goal })}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                              title="Edit Tabungan ini"
                            >
                              <Pencil size={12} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSavingsGoal(goal.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                              title="Hapus Tabungan"
                            >
                              <Trash2 size={12} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDepositGoalId(goal.id);
                                setDepositAmount('100000');
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#DFB76C] hover:brightness-105 active:scale-95 text-[#080E1E] text-xs font-black font-num transition-all cursor-pointer shadow-sm"
                            >
                              + Nabung
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar & Amounts dengan Font Angka Jelas */}
                        <div className="space-y-1.5">
                          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-[#DFB76C]"
                              style={{
                                width: `${progress}%`,
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-num">
                            <span className="text-slate-200 font-black tracking-tight">
                              {formatRupiah(goal.currentAmount)}
                            </span>
                            <span className="text-slate-400 font-semibold">
                              dari {formatRupiah(goal.targetAmount)} ({progress}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {/* ========================================================
              TAB 4: ANGGARAN (PROGRESS BAR INTERAKTIF ALOKASI BUDGET BULANAN)
              * Terletak di samping navigasi Tabungan
             ======================================================== */}
          {activeTab === 'anggaran' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Header Card Ringkasan Budget Bulanan */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121E3D] via-[#0D162E] to-[#080E1E] border border-[#DFB76C]/30 p-5 shadow-xl shadow-black/50 group">
                <div className="flex items-center justify-between text-slate-400 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-slate-300">
                    <div className="p-1.5 rounded-xl bg-[#DFB76C]/15 border border-[#DFB76C]/30 text-[#DFB76C] animate-icon-glow">
                      <Target size={15} className="animate-icon-float" />
                    </div>
                    Alokasi Budget Bulan Ini
                  </span>
                  <span className="text-[10px] font-bold text-[#DFB76C] bg-[#DFB76C]/10 border border-[#DFB76C]/20 px-2.5 py-0.5 rounded-full font-num animate-icon-pulse">
                    Sisa {budgetAnalytics.remainingDays} Hari
                  </span>
                </div>

                {/* Baris Atas: Kapasitas Budget (Kiri) vs Total Terpakai (Kanan) */}
                <div className="grid grid-cols-2 gap-4 items-end mb-3.5">
                  {/* Sisi Kiri: Kapasitas Total Budget */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Kapasitas Total
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenEditCapacity}
                        className="p-1 rounded-md bg-[#DFB76C]/15 hover:bg-[#DFB76C]/25 text-[#DFB76C] transition-all cursor-pointer inline-flex items-center gap-0.5 group/btn hover:scale-110 active:scale-95"
                        title="Klik untuk mengubah kapasitas total budget"
                      >
                        <Pencil size={11} className="group-hover/btn:rotate-45 group-hover/btn:scale-125 transition-all duration-300" />
                        <span className="text-[9px] font-bold underline decoration-dotted">Edit</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenEditCapacity}
                      className="group/cap text-left cursor-pointer focus:outline-none hover:scale-105 transition-transform"
                      title="Klik untuk mengubah kapasitas total budget"
                    >
                      <span className="text-xl sm:text-2xl font-black font-num text-white tracking-tight group-hover/cap:text-[#DFB76C] transition-colors">
                        {formatRupiah(budgetAnalytics.totalBudget)}
                      </span>
                    </button>
                  </div>

                  {/* Sisi Kanan: Total Terpakai */}
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-1">
                      Total Terpakai
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-num text-slate-200 tracking-tight">
                      {formatRupiah(budgetAnalytics.totalSpentInBudget)}
                    </span>
                  </div>
                </div>

                {/* Master Interactive Progress Bar */}
                <div className="space-y-2">
                  <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden border border-white/10 p-0.5 flex">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        budgetAnalytics.overallPercentage >= 100
                          ? 'bg-gradient-to-r from-red-600 to-red-400'
                          : budgetAnalytics.overallPercentage >= 85
                          ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-500 to-[#DFB76C]'
                      }`}
                      style={{ width: `${Math.min(100, budgetAnalytics.overallPercentage)}%` }}
                    />
                  </div>

                  {/* Baris Bawah: Terpakai (%) & Sisa Dana */}
                  <div className="flex items-center justify-between text-[11px] font-num">
                    <span className="text-slate-400 font-semibold">
                      Terpakai {budgetAnalytics.overallPercentage}%
                    </span>
                    <span
                      className={`font-black ${
                        budgetAnalytics.overallRemaining < 0
                          ? 'text-red-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {budgetAnalytics.overallRemaining >= 0
                        ? `Sisa ${formatRupiah(budgetAnalytics.overallRemaining)}`
                        : `Overbudget ${formatRupiah(Math.abs(budgetAnalytics.overallRemaining))}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Bar: Tambah Budget Baru */}
              <div className="flex items-center justify-end px-1">
                <button
                  type="button"
                  onClick={handleOpenAddBudget}
                  className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-md hover:shadow-[#DFB76C]/20"
                >
                  <Plus size={13} strokeWidth={2.5} className="group-hover:rotate-90 group-hover:scale-125 transition-all duration-300" />
                  <span>Atur Budget</span>
                </button>
              </div>

              {/* Interactive List of Budget Progress Bars */}
              <div className="space-y-3">
                {budgetAnalytics.items.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl bg-[#080E1E] border border-white/5 space-y-3 px-4">
                    <Target size={32} className="mx-auto text-slate-600 animate-icon-float" />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">Pos Anggaran</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tentukan batas maksimal belanja per kategori agar keuangan tetap terkontrol
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddBudget}
                      className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      <Plus size={14} strokeWidth={2.5} className="group-hover:rotate-90 group-hover:scale-125 transition-all duration-300" />
                      <span>Buat Pos Alokasi Pertama</span>
                    </button>
                  </div>
                ) : (
                  budgetAnalytics.items.map((item) => {
                    const isOver = item.percentage >= 100;
                    const isWarning = item.percentage >= 85 && !isOver;
                    const CategoryIcon = getCategoryIconComponent(item.category);

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-[#080E1E] border border-white/[0.06] space-y-3 hover:border-white/15 transition-all shadow-md group"
                      >
                        {/* Header Pos: Kategori & Status Badge */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 border shadow-md animate-icon-float"
                              style={{
                                backgroundColor: `${item.color || '#DFB76C'}20`,
                                borderColor: `${item.color || '#DFB76C'}40`,
                                color: item.color || '#DFB76C',
                              }}
                            >
                              <CategoryIcon size={18} className="group-hover:scale-125 transition-transform duration-300" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-white">{item.category}</h4>
                                {isOver && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                    <AlertTriangle size={10} className="animate-alert-shake" /> Over!
                                  </span>
                                )}
                                {isWarning && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                    <AlertTriangle size={10} className="animate-icon-pulse" /> Waspada
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-num">
                                Limit {formatRupiah(item.limit)}
                              </span>
                            </div>
                          </div>

                          {/* Tombol Aksi Edit & Hapus */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBudget(item);
                                setBudgetLimit(item.limit.toString());
                                const currentSubs = item.subcategories || [];
                                const knownCatSubs = categorySubcategories[item.category] || [];
                                const merged = [...currentSubs];
                                knownCatSubs.forEach((ks) => {
                                  if (!merged.some((m) => m.name.toLowerCase() === ks.toLowerCase())) {
                                    merged.push({
                                      id: `sub-init-${Date.now()}-${merged.length}`,
                                      name: ks,
                                      limit: 0,
                                    });
                                  }
                                });
                                setEditingBudgetSubcategories(merged);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-[#DFB76C] hover:scale-125 hover:rotate-12 active:scale-90 transition-all cursor-pointer group/btn"
                              title="Ubah Limit Budget"
                            >
                              <Pencil size={12} className="group-hover/btn:rotate-12 transition-transform" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBudget(item.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 hover:scale-125 hover:-rotate-12 active:scale-90 transition-all cursor-pointer group/btn"
                              title="Hapus Budget"
                            >
                              <Trash2 size={12} className="group-hover/btn:scale-110 transition-transform" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar Interaktif Kategori */}
                        <div className="space-y-1.5">
                          <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5 p-0.5 flex">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOver
                                  ? 'bg-red-500'
                                  : isWarning
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{
                                width: `${Math.min(100, item.percentage)}%`,
                              }}
                            />
                          </div>

                          {/* Angka Terpakai vs Limit */}
                          <div className="flex items-center justify-between text-[11px] font-num">
                            <span className="text-slate-200 font-black tracking-tight">
                              {formatRupiah(item.spent)}
                            </span>
                            <span className="text-slate-400 font-semibold">
                              Terpakai {item.percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Status Deskriptif Sisa Dana di Bagian Bawah */}
                        <div className="pt-1.5 border-t border-white/[0.04]">
                          <div className="flex items-center justify-between text-[10px] font-num">
                            <span className="text-slate-500">
                              {isOver ? 'Melebihi kuota alokasi' : 'Sisa kuota belanja'}
                            </span>
                            <span
                              className={`font-black ${
                                isOver ? 'text-red-400' : 'text-emerald-400'
                              }`}
                            >
                              {formatRupiah(Math.abs(item.remaining))}
                            </span>
                          </div>
                        </div>

                        {/* Rincian Hierarkis Sub-Kategori (Accordion Interaktif) */}
                        <div className="pt-2 border-t border-white/[0.04]">
                          <button
                            type="button"
                            data-sound="accordion"
                            onClick={() =>
                              setExpandedBudgets((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            className="group/acc w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Layers size={12} className="text-[#DFB76C] animate-icon-pulse group-hover/acc:scale-125 transition-transform" />
                              <span>
                                {item.subcategoryItems?.length || 0} Rincian Sub-Kategori
                              </span>
                            </span>
                            <span className="flex items-center gap-1 text-[9px] text-[#DFB76C] font-bold">
                              <span>{expandedBudgets[item.id] ? 'Tutup' : 'Buka Rincian'}</span>
                              <ChevronDown
                                size={13}
                                className={`transition-transform duration-300 ${
                                  expandedBudgets[item.id] ? 'rotate-180 text-[#DFB76C]' : 'text-slate-400'
                                }`}
                              />
                            </span>
                          </button>

                          {expandedBudgets[item.id] && (
                            <div className="mt-2 space-y-2.5 pl-1.5 pr-0.5 animate-expand">
                              {(!item.subcategoryItems || item.subcategoryItems.length === 0) ? (
                                <p className="text-[10px] text-slate-500 italic py-1 text-center">
                                  Belum ada sub-kategori. Klik tombol pensil di atas untuk mengatur limit per sub-kategori.
                                </p>
                              ) : (
                                item.subcategoryItems.map((sub) => {
                                  const subIsOver = sub.limit > 0 && sub.percentage >= 100;
                                  const subIsWarning = sub.limit > 0 && sub.percentage >= 85 && !subIsOver;

                                  return (
                                    <div
                                      key={sub.id}
                                      className="p-2.5 rounded-xl bg-[#050B17]/90 border border-white/[0.04] space-y-1.5 hover:border-white/10 transition-all hover:bg-[#050B17]"
                                    >
                                      <div className="flex items-center justify-between text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-2 rounded-full animate-icon-pulse shadow-sm shrink-0"
                                            style={{
                                              backgroundColor: item.color || '#DFB76C',
                                              boxShadow: `0 0 6px ${item.color || '#DFB76C'}60`,
                                            }}
                                          />
                                          <span className="font-bold text-slate-200">{sub.name}</span>
                                        </div>
                                        <span className="font-num text-[10px] font-black text-slate-200">
                                          {formatRupiah(sub.spent)}
                                          {sub.limit > 0 && (
                                            <span className="text-slate-500 font-normal ml-1">
                                              / {formatRupiah(sub.limit)}
                                            </span>
                                          )}
                                        </span>
                                      </div>

                                      {/* Mini Progress Bar Sub-Kategori */}
                                      {sub.limit > 0 ? (
                                        <>
                                          <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/[0.04]">
                                            <div
                                              className={`h-full rounded-full transition-all duration-300 ${
                                                subIsOver
                                                  ? 'bg-red-500'
                                                  : subIsWarning
                                                  ? 'bg-amber-400'
                                                  : 'bg-[#DFB76C]'
                                              }`}
                                              style={{ width: `${Math.min(100, sub.percentage)}%` }}
                                            />
                                          </div>
                                          <div className="flex items-center justify-between text-[9px] font-num text-slate-500">
                                            <span>Terpakai {sub.percentage}%</span>
                                            <span
                                              className={
                                                subIsOver
                                                  ? 'text-red-400 font-semibold'
                                                  : 'text-emerald-400 font-semibold'
                                              }
                                            >
                                              {subIsOver
                                                ? `Over ${formatRupiah(Math.abs(sub.remaining))}`
                                                : `Sisa ${formatRupiah(sub.remaining)}`}
                                            </span>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-[9px] text-slate-500 italic">
                                          Total pengeluaran tercatat (tanpa batas limit tersendiri)
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </main>

        {/* ========================================================
            BOTTOM NAVIGATION (BERANDA, TRANSAKSI, TABUNGAN, ANGGARAN)
            * Ikon beranimasi halus saat diklik/aktif
           ======================================================== */}
        <nav className="fixed bottom-0 max-w-md w-full z-40 bg-[#080E1E]/95 backdrop-blur-2xl border-t border-white/[0.08] px-4 py-2 shadow-2xl">
          <div className="grid grid-cols-4 gap-1">
            {/* 1. Beranda */}
            <button
              type="button"
              data-sound="tab"
              onClick={() => setActiveTab('beranda')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'beranda'
                  ? 'text-[#DFB76C]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-300 ${
                  activeTab === 'beranda'
                    ? 'bg-[#DFB76C]/15 shadow-md shadow-[#DFB76C]/20 scale-110'
                    : 'hover:scale-105 active:scale-95'
                }`}
              >
                <Home size={18} strokeWidth={activeTab === 'beranda' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-bold tracking-tight mt-1">Beranda</span>
            </button>

            {/* 2. Transaksi */}
            <button
              type="button"
              data-sound="tab"
              onClick={() => setActiveTab('transaksi')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'transaksi'
                  ? 'text-[#DFB76C]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-300 ${
                  activeTab === 'transaksi'
                    ? 'bg-[#DFB76C]/15 shadow-md shadow-[#DFB76C]/20 scale-110'
                    : 'hover:scale-105 active:scale-95'
                }`}
              >
                <Receipt size={18} strokeWidth={activeTab === 'transaksi' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-bold tracking-tight mt-1">Transaksi</span>
            </button>

            {/* 3. Tabungan (Ikon Dompet / Wallet) */}
            <button
              type="button"
              data-sound="tab"
              onClick={() => setActiveTab('tabungan')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'tabungan'
                  ? 'text-[#DFB76C]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-300 ${
                  activeTab === 'tabungan'
                    ? 'bg-[#DFB76C]/15 shadow-md shadow-[#DFB76C]/20 scale-110'
                    : 'hover:scale-105 active:scale-95'
                }`}
              >
                <Wallet size={18} strokeWidth={activeTab === 'tabungan' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-bold tracking-tight mt-1">Tabungan</span>
            </button>

            {/* 4. Anggaran (Di Samping Navigasi Tabungan) */}
            <button
              type="button"
              data-sound="tab"
              onClick={() => setActiveTab('anggaran')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                activeTab === 'anggaran'
                  ? 'text-[#DFB76C]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-300 ${
                  activeTab === 'anggaran'
                    ? 'bg-[#DFB76C]/15 shadow-md shadow-[#DFB76C]/20 scale-110 animate-icon-glow'
                    : 'hover:scale-105 active:scale-95'
                }`}
              >
                <Target
                  size={18}
                  strokeWidth={activeTab === 'anggaran' ? 2.5 : 2}
                  className={activeTab === 'anggaran' ? 'animate-icon-float' : ''}
                />
              </div>
              <span className="text-[10px] font-bold tracking-tight mt-1">Anggaran</span>
            </button>
          </div>
        </nav>
      </div>

      {/* ========================================================
          MODAL: KELOLA FOTO PROFIL MANUAL (UPLOAD & PRESET)
         ======================================================== */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm"
            onClick={() => setShowProfileModal(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#DFB76C]/20 text-[#DFB76C] flex items-center justify-center">
                  <User size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Foto Profil Pengguna</h3>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Preview Foto Saat Ini */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative group">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-20 h-20 rounded-3xl object-cover border-2 border-[#DFB76C] shadow-xl shadow-[#DFB76C]/20"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#121E3D] to-[#070D1E] border-2 border-[#DFB76C]/40 flex items-center justify-center shadow-xl shadow-black/50">
                      <span className="text-3xl font-black font-num text-[#DFB76C]">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {isUploadingPhoto && (
                    <div className="absolute inset-0 rounded-3xl bg-black/70 backdrop-blur-xs flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-[#DFB76C]" />
                    </div>
                  )}

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-[#DFB76C] text-[#070D1E] shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
                    title="Upload Foto Baru"
                  >
                    <Camera size={14} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-white">{userName}</p>
                  <p className="text-[11px] text-slate-400">{userEmail}</p>
                  <p className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center justify-center gap-1">
                    <CheckCircle2 size={11} />
                    <span>Tersinkronisasi lintas perangkat</span>
                  </p>
                </div>
              </div>

              {/* Input File Tersembunyi */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPhoto}
                className="hidden"
              />

              {/* Tombol Upload Manual dari Perangkat */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="w-full py-2.5 px-4 rounded-xl bg-[#DFB76C] hover:brightness-105 active:scale-[0.99] text-[#080E1E] font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#DFB76C]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isUploadingPhoto ? (
                  <Loader2 size={15} className="animate-spin text-[#080E1E]" />
                ) : (
                  <Upload size={15} strokeWidth={2.5} />
                )}
                <span>{isUploadingPhoto ? 'Menyinkronkan Foto ke Akun...' : 'Upload Foto dari Galeri / Kamera'}</span>
              </button>

              {/* Pilihan Avatar Siap Pakai (Presets) */}
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                  Atau Pilih Avatar Pilihan:
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {presetAvatars.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => handleSelectPresetAvatar(url)}
                      className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all hover:scale-105 cursor-pointer disabled:opacity-50 ${
                        userAvatar === url
                          ? 'border-[#DFB76C] shadow-md shadow-[#DFB76C]/30'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                      {userAvatar === url && (
                        <div className="absolute inset-0 bg-[#DFB76C]/30 flex items-center justify-center text-white">
                          <Check size={12} strokeWidth={3} className="text-[#DFB76C]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tombol Hapus Foto Jika Ada */}
              {userAvatar && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isUploadingPhoto}
                  className="w-full py-2 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors cursor-pointer text-center disabled:opacity-50"
                >
                  Hapus Foto Profil (Gunakan Monogram Inisial)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: TAMBAH TRANSAKSI
         ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    addModalType === 'income'
                      ? 'bg-[#DFB76C]/20 text-[#DFB76C]'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  <Plus size={16} strokeWidth={2.5} />
                </div>
                <h3 className="text-sm font-bold text-white">Catat Transaksi</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Type Switcher */}
            <div className="grid grid-cols-2 p-1 bg-[#050B17] rounded-2xl border border-white/[0.08] my-4">
              <button
                type="button"
                onClick={() => {
                  setAddModalType('expense');
                  setFormCategory(expenseCategories[0] || '');
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  addModalType === 'expense'
                    ? 'bg-red-500/90 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddModalType('income');
                  setFormCategory(incomeCategories[0] || '');
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  addModalType === 'income'
                    ? 'bg-[#DFB76C] text-[#080E1E] shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pemasukan
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nama Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={
                    addModalType === 'income' ? 'Contoh: Gaji Pokok, Usaha' : 'Contoh: Makan Siang, Bensin'
                  }
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="Contoh: 50000"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3.5 py-2.5 text-xs text-white font-num font-bold placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Kategori
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryModalTab(addModalType);
                        setShowCategoryModal(true);
                      }}
                      className="text-[10px] text-[#DFB76C] hover:underline cursor-pointer"
                    >
                      + Kelola
                    </button>
                  </div>

                  {(addModalType === 'income' ? incomeCategories : expenseCategories).length > 0 ? (
                    <select
                      value={formCategory}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setFormCategory(newCat);
                        const availableSubs = categorySubcategories[newCat] || [];
                        setFormSubcategory(availableSubs[0] || '');
                      }}
                      className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                    >
                      {(addModalType === 'income' ? incomeCategories : expenseCategories).map(
                        (cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        )
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="Ketik kategori..."
                      className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl bg-[#050B17] border border-white/10 px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#DFB76C] font-num"
                  />
                </div>
              </div>

              {/* Input Sub-Kategori Khusus Pengeluaran (Terhubung Langsung ke Anggaran) */}
              {addModalType === 'expense' && (
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-[#DFB76C] uppercase tracking-wider flex items-center gap-1">
                      <Layers size={11} />
                      <span>Sub-Kategori Pengeluaran</span>
                    </label>
                    <span className="text-[9px] text-slate-500">Otomatis masuk anggaran</span>
                  </div>

                  {categorySubcategories[formCategory] && categorySubcategories[formCategory].length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={formSubcategory}
                        onChange={(e) => setFormSubcategory(e.target.value)}
                        className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                      >
                        <option value="">Pilih Sub-Kategori...</option>
                        {categorySubcategories[formCategory].map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>

                      {/* Quick input untuk tambah subkategori baru secara cepat */}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newSubcategoryName}
                          onChange={(e) => setNewSubcategoryName(e.target.value)}
                          placeholder="+ Sub-kategori baru..."
                          className="flex-1 rounded-lg bg-[#050B17] border border-white/10 px-2.5 py-1 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = newSubcategoryName.trim();
                              if (trimmed && formCategory) {
                                const current = categorySubcategories[formCategory] || [];
                                if (!current.includes(trimmed)) {
                                  setCategorySubcategories((prev) => ({
                                    ...prev,
                                    [formCategory]: [...(prev[formCategory] || []), trimmed],
                                  }));
                                }
                                setFormSubcategory(trimmed);
                                setNewSubcategoryName('');
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newSubcategoryName.trim();
                            if (trimmed && formCategory) {
                              const current = categorySubcategories[formCategory] || [];
                              if (!current.includes(trimmed)) {
                                setCategorySubcategories((prev) => ({
                                  ...prev,
                                  [formCategory]: [...(prev[formCategory] || []), trimmed],
                                }));
                              }
                              setFormSubcategory(trimmed);
                              setNewSubcategoryName('');
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-slate-200 cursor-pointer"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={formSubcategory}
                        onChange={(e) => setFormSubcategory(e.target.value)}
                        placeholder="Contoh: Sarapan, Bensin, Kopi..."
                        className="flex-1 rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Keterangan singkat"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              {/* Error Message jika Supabase mengembalikan error */}
              {transactionError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium animate-in fade-in duration-150">
                  {transactionError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-[#DFB76C]/20 cursor-pointer pt-2 mt-2 flex items-center justify-center gap-2"
              >
                <span>Simpan Transaksi</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT TRANSAKSI MANUAL
         ======================================================== */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setEditingTransaction(null)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#DFB76C]/20 text-[#DFB76C] flex items-center justify-center">
                  <Pencil size={15} />
                </div>
                <h3 className="text-sm font-bold text-white">Edit Transaksi</h3>
              </div>
              <button
                onClick={() => setEditingTransaction(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateTransaction} className="space-y-3.5 py-3">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 p-1 bg-[#050B17] rounded-2xl border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() =>
                    setEditingTransaction({
                      ...editingTransaction,
                      type: 'expense',
                      category: expenseCategories[0] || editingTransaction.category,
                    })
                  }
                  className={`py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    editingTransaction.type === 'expense'
                      ? 'bg-red-500/90 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditingTransaction({
                      ...editingTransaction,
                      type: 'income',
                      category: incomeCategories[0] || editingTransaction.category,
                    })
                  }
                  className={`py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    editingTransaction.type === 'income'
                      ? 'bg-[#DFB76C] text-[#080E1E] shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nama Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={editingTransaction.title}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, title: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editingTransaction.amount}
                  onChange={(e) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      amount: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Kategori
                  </label>
                  {(editingTransaction.type === 'income' ? incomeCategories : expenseCategories).length > 0 ? (
                    <select
                      value={editingTransaction.category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        const defaultSubs = categorySubcategories[newCat] || [];
                        setEditingTransaction({
                          ...editingTransaction,
                          category: newCat,
                          subCategory: defaultSubs[0] || '',
                        });
                      }}
                      className="w-full rounded-xl bg-[#050B17] border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                    >
                      {(editingTransaction.type === 'income'
                        ? incomeCategories
                        : expenseCategories
                      ).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editingTransaction.category}
                      onChange={(e) =>
                        setEditingTransaction({ ...editingTransaction, category: e.target.value })
                      }
                      className="w-full rounded-xl bg-[#050B17] border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={editingTransaction.date}
                    onChange={(e) =>
                      setEditingTransaction({ ...editingTransaction, date: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#050B17] border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C] font-num"
                  />
                </div>
              </div>

              {/* Sub-Kategori pada Modal Edit Transaksi (Hanya jika pengeluaran) */}
              {editingTransaction.type === 'expense' && (
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-[#DFB76C] uppercase tracking-wider flex items-center gap-1">
                      <Layers size={11} />
                      <span>Sub-Kategori Pengeluaran</span>
                    </label>
                  </div>

                  {categorySubcategories[editingTransaction.category] &&
                  categorySubcategories[editingTransaction.category].length > 0 ? (
                    <select
                      value={editingTransaction.subCategory || ''}
                      onChange={(e) =>
                        setEditingTransaction({
                          ...editingTransaction,
                          subCategory: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                    >
                      <option value="">Pilih Sub-Kategori...</option>
                      {categorySubcategories[editingTransaction.category].map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editingTransaction.subCategory || ''}
                      onChange={(e) =>
                        setEditingTransaction({
                          ...editingTransaction,
                          subCategory: e.target.value,
                        })
                      }
                      placeholder="Contoh: Sarapan, Bensin..."
                      className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={editingTransaction.notes || ''}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, notes: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteTransaction(editingTransaction.id)}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Hapus</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 transition-all shadow-md shadow-[#DFB76C]/20 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: KELOLA KATEGORI PEMASUKAN & PENGELUARAN
         ======================================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => {
              setShowCategoryModal(false);
              setEditingCategoryIndex(null);
            }}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#DFB76C]/20 text-[#DFB76C] flex items-center justify-center">
                  <Tag size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Kelola Kategori Manual</h3>
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryIndex(null);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab: Pengeluaran vs Pemasukan */}
            <div className="grid grid-cols-2 p-1 bg-[#050B17] rounded-2xl border border-white/[0.08] my-4">
              <button
                type="button"
                onClick={() => {
                  setCategoryModalTab('expense');
                  setEditingCategoryIndex(null);
                }}
                className={`py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  categoryModalTab === 'expense'
                    ? 'bg-red-500/90 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Kategori Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryModalTab('income');
                  setEditingCategoryIndex(null);
                }}
                className={`py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  categoryModalTab === 'income'
                    ? 'bg-[#DFB76C] text-[#080E1E] shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Kategori Pemasukan
              </button>
            </div>

            {/* List Kategori */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 my-3">
              {(categoryModalTab === 'expense' ? expenseCategories : incomeCategories).length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  Belum ada kategori {categoryModalTab === 'expense' ? 'pengeluaran' : 'pemasukan'}. Tambahkan di bawah.
                </div>
              ) : (
                (categoryModalTab === 'expense' ? expenseCategories : incomeCategories).map(
                  (cat, idx) => (
                    <div
                      key={`${cat}-${idx}`}
                      className="p-2.5 rounded-xl bg-[#050B17] border border-white/5 flex items-center justify-between gap-2"
                    >
                      {editingCategoryIndex === idx ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingCategoryValue}
                            onChange={(e) => setEditingCategoryValue(e.target.value)}
                            className="flex-1 bg-black/40 border border-[#DFB76C]/50 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditCategory(idx)}
                            className="px-2 py-1 rounded-lg bg-[#DFB76C] text-[#080E1E] text-xs font-bold"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryIndex(null)}
                            className="px-1.5 py-1 text-slate-400 text-xs"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                categoryModalTab === 'expense' ? 'bg-red-400' : 'bg-[#DFB76C]'
                              }`}
                            />
                            <span className="text-xs text-white font-medium">{cat}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryIndex(idx);
                                setEditingCategoryValue(cat);
                              }}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                              title="Edit Nama Kategori"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(idx)}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                              title="Hapus Kategori"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                )
              )}
            </div>

            {/* Form Tambah Kategori Baru */}
            <form onSubmit={handleAddCategory} className="flex gap-2 pt-2 border-t border-white/[0.08]">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Kategori baru..."
                className="flex-1 rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#DFB76C]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#DFB76C] text-[#080E1E] text-xs font-bold hover:brightness-105 transition-all shadow-md"
              >
                + Tambah
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: TAMBAH TARGET TABUNGAN BARU
         ======================================================== */}
      {showAddSavingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddSavingsModal(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Wallet size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Target Tabungan Baru</h3>
              </div>
              <button
                onClick={() => setShowAddSavingsModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSavingsGoal} className="space-y-3 py-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nama Impian / Rencana
                </label>
                <input
                  type="text"
                  required
                  value={newSavingsTitle}
                  onChange={(e) => setNewSavingsTitle(e.target.value)}
                  placeholder="Contoh: Beli Motor, Umroh, Dana Darurat"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Kategori Tabungan
                </label>
                <input
                  type="text"
                  value={newSavingsCategory}
                  onChange={(e) => setNewSavingsCategory(e.target.value)}
                  placeholder="Contoh: Kendaraan, Ibadah, Masa Depan"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Target Nominal (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    value={newSavingsTarget}
                    onChange={(e) => setNewSavingsTarget(e.target.value)}
                    placeholder="Contoh: 10000000"
                    className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newSavingsInitial}
                    onChange={(e) => setNewSavingsInitial(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Target Waktu
                </label>
                <input
                  type="text"
                  value={newSavingsDate}
                  onChange={(e) => setNewSavingsDate(e.target.value)}
                  placeholder="Contoh: Desember 2026 / Fleksibel"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C] font-num"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer mt-2"
              >
                Buat Target Tabungan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT MANUAL TARGET TABUNGAN
         ======================================================== */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setEditingGoal(null)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#DFB76C]/20 text-[#DFB76C] flex items-center justify-center">
                  <Pencil size={15} />
                </div>
                <h3 className="text-sm font-bold text-white">Edit Target Tabungan</h3>
              </div>
              <button
                onClick={() => setEditingGoal(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateSavingsGoal} className="space-y-3 py-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nama Target Tabungan
                </label>
                <input
                  type="text"
                  required
                  value={editingGoal.title}
                  onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Kategori Tabungan
                </label>
                <input
                  type="text"
                  value={editingGoal.category}
                  onChange={(e) => setEditingGoal({ ...editingGoal, category: e.target.value })}
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Target (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    value={editingGoal.targetAmount}
                    onChange={(e) =>
                      setEditingGoal({
                        ...editingGoal,
                        targetAmount: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Terkumpul (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingGoal.currentAmount}
                    onChange={(e) =>
                      setEditingGoal({
                        ...editingGoal,
                        currentAmount: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Target Waktu
                </label>
                <input
                  type="text"
                  value={editingGoal.targetDate}
                  onChange={(e) =>
                    setEditingGoal({ ...editingGoal, targetDate: e.target.value })
                  }
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C] font-num"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteSavingsGoal(editingGoal.id);
                    setEditingGoal(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  <span>Hapus</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: NABUNG KE TARGET
         ======================================================== */}
      {depositGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setDepositGoalId(null)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#DFB76C]/20 text-[#DFB76C] flex items-center justify-center">
                  <Wallet size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Nabung ke Target</h3>
              </div>
              <button
                onClick={() => setDepositGoalId(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDepositToGoal} className="space-y-3.5 py-3">
              <p className="text-xs text-slate-400">
                Alokasikan dana ke impian:{' '}
                <span className="text-white font-bold">
                  {savingsGoals.find((g) => g.id === depositGoalId)?.title}
                </span>
              </p>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nominal Tabungan (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Contoh: 100000"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  autoFocus
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex gap-2">
                {[50000, 100000, 250000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt.toString())}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/5 cursor-pointer font-num font-bold"
                  >
                    +{amt / 1000}k
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer mt-2"
              >
                Tambahkan ke Tabungan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ATUR POS BUDGET / ALOKASI BARU
         ======================================================== */}
      {showAddBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddBudgetModal(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-[#DFB76C]/15 text-[#DFB76C]">
                  <Target size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Atur Budget</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBudgetModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="space-y-3.5 py-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Kategori Pengeluaran
                </label>
                {expenseCategories.length > 0 ? (
                  <select
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DFB76C] cursor-pointer"
                  >
                    <option value="">Pilih Kategori atau Ketik Baru...</option>
                    {expenseCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#080E1E] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                ) : null}

                {(expenseCategories.length === 0 || budgetCategory === '' || !expenseCategories.includes(budgetCategory)) && (
                  <input
                    type="text"
                    required
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    placeholder="Contoh: Makanan, Transportasi, Belanja..."
                    className="w-full mt-1.5 rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                  />
                )}
              </div>

              {/* Info Kuota Kapasitas Budget Bulan Ini */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Total Budget Bulan Ini:</span>
                  <span className="font-num font-bold text-white">
                    {formatRupiah(budgetAnalytics.totalBudget)}
                  </span>
                </div>
                {budgetAnalytics.isCustomCapacity && (
                  <>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Pos Kategori Lain:</span>
                      <span className="font-num font-semibold text-slate-300">
                        {formatRupiah(
                          budgets
                            .filter((b) => b.category.toLowerCase() !== budgetCategory.toLowerCase())
                            .reduce((sum, b) => sum + b.monthlyLimit, 0)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/[0.06]">
                      <span className="text-[#DFB76C] font-semibold flex items-center gap-1">
                        <Sparkles size={11} />
                        Sisa Alokasi Tersedia:
                      </span>
                      {(() => {
                        const otherTotal = budgets
                          .filter((b) => b.category.toLowerCase() !== budgetCategory.toLowerCase())
                          .reduce((sum, b) => sum + b.monthlyLimit, 0);
                        const maxAvail = Math.max(0, budgetAnalytics.totalBudget - otherTotal);
                        return (
                          <button
                            type="button"
                            onClick={() => setBudgetLimit(maxAvail.toString())}
                            className="font-num font-black text-[#DFB76C] hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Klik untuk gunakan semua sisa kuota"
                          >
                            <span>{formatRupiah(maxAvail)}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#DFB76C]/20 border border-[#DFB76C]/30 text-[#DFB76C]">
                              Gunakan
                            </span>
                          </button>
                        );
                      })()}
                    </div>
                  </>
                )}
                {!budgetAnalytics.isCustomCapacity && (
                  <p className="text-[10px] text-slate-400 italic">
                    💡 Mode Fleksibel: Anda bebas menentukan nominal berapapun. Total budget bulanan akan otomatis terakumulasi.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Batas Maksimal Bulanan (Rp)
                  </label>
                  {budgetLimit && !isNaN(parseInt(budgetLimit.replace(/\D/g, ''), 10)) && (
                    <span className="text-[11px] font-num font-black text-[#DFB76C]">
                      {formatRupiah(parseInt(budgetLimit.replace(/\D/g, ''), 10))}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="Masukkan nominal bebas (misal: 150000)"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2.5 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  autoFocus
                />

                {/* Validasi apakah melebihi budget bulan ini */}
                {(() => {
                  if (!budgetAnalytics.isCustomCapacity) return null;
                  const limitNum = parseInt(budgetLimit.replace(/\D/g, ''), 10) || 0;
                  const otherTotal = budgets
                    .filter((b) => b.category.toLowerCase() !== budgetCategory.toLowerCase())
                    .reduce((sum, b) => sum + b.monthlyLimit, 0);
                  const maxAvail = Math.max(0, budgetAnalytics.totalBudget - otherTotal);

                  if (limitNum > maxAvail) {
                    return (
                      <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 animate-in fade-in duration-200">
                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-red-300">
                          <p className="font-bold">Melebihi Sisa Budget Bulan Ini!</p>
                          <p className="text-[10px] text-red-300/80 mt-0.5">
                            Maksimal sisa kuota yang dapat dialokasikan adalah{' '}
                            <span className="font-bold text-white">{formatRupiah(maxAvail)}</span>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setBudgetLimit(maxAvail.toString())}
                            className="mt-1.5 text-[10px] font-bold text-white bg-red-500/40 hover:bg-red-500/60 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                          >
                            Sesuaikan ke {formatRupiah(maxAvail)}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Quick Limit Options */}
              <div className="grid grid-cols-4 gap-1.5">
                {[100000, 250000, 500000, 1000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBudgetLimit(amt.toString())}
                    className="py-1.5 px-1 text-center rounded-lg bg-white/5 hover:bg-white/10 hover:border-[#DFB76C]/40 text-[11px] text-slate-300 border border-white/5 cursor-pointer font-num font-bold transition-all"
                  >
                    {amt >= 1000000 ? `${amt / 1000000}Jt` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>

              {/* Input Rincian Sub-Kategori Anggaran */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-[#DFB76C] uppercase tracking-wider flex items-center gap-1">
                    <Layers size={11} />
                    <span>Rincian Limit Sub-Kategori (Opsional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBudgetSubcategories((prev) => [
                        ...prev,
                        { id: `sub-${Date.now()}`, name: '', limit: 0 },
                      ]);
                    }}
                    className="text-[10px] text-[#DFB76C] hover:underline cursor-pointer"
                  >
                    + Tambah Sub
                  </button>
                </div>
                
                {editingBudgetSubcategories.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Belum ada sub-kategori. Klik "+ Tambah Sub" jika ingin membatasi pengeluaran per sub-kategori (misal: Sarapan, Kopi, dsb).
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {editingBudgetSubcategories.map((sub, sIdx) => (
                      <div key={sub.id || sIdx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingBudgetSubcategories((prev) =>
                              prev.map((item, idx) => (idx === sIdx ? { ...item, name: val } : item))
                            );
                          }}
                          placeholder="Nama sub (misal: Kopi)"
                          className="flex-1 rounded-lg bg-[#050B17] border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={sub.limit || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setEditingBudgetSubcategories((prev) =>
                              prev.map((item, idx) => (idx === sIdx ? { ...item, limit: val } : item))
                            );
                          }}
                          placeholder="Limit (Rp)"
                          className="w-28 rounded-lg bg-[#050B17] border border-white/10 px-2 py-1.5 text-xs text-white font-num font-bold placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBudgetSubcategories((prev) => prev.filter((_, idx) => idx !== sIdx));
                          }}
                          className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer mt-2"
              >
                Pasang Alokasi Budget
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: UBAH LIMIT BUDGET
         ======================================================== */}
      {editingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setEditingBudget(null)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-[#DFB76C]/15 text-[#DFB76C]">
                  <Pencil size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Ubah Limit: {editingBudget.category}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBudget(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateBudgetLimit} className="space-y-3.5 py-3">
              {/* Info Kuota Kapasitas Budget Bulan Ini */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Total Budget Bulan Ini:</span>
                  <span className="font-num font-bold text-white">
                    {formatRupiah(budgetAnalytics.totalBudget)}
                  </span>
                </div>
                {budgetAnalytics.isCustomCapacity && (
                  <>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Pos Kategori Lain:</span>
                      <span className="font-num font-semibold text-slate-300">
                        {formatRupiah(
                          budgets
                            .filter((b) => b.id !== editingBudget.id)
                            .reduce((sum, b) => sum + b.monthlyLimit, 0)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/[0.06]">
                      <span className="text-[#DFB76C] font-semibold flex items-center gap-1">
                        <Sparkles size={11} />
                        Maksimal Alokasi Tersedia:
                      </span>
                      {(() => {
                        const otherTotal = budgets
                          .filter((b) => b.id !== editingBudget.id)
                          .reduce((sum, b) => sum + b.monthlyLimit, 0);
                        const maxAvail = Math.max(0, budgetAnalytics.totalBudget - otherTotal);
                        return (
                          <button
                            type="button"
                            onClick={() => setBudgetLimit(maxAvail.toString())}
                            className="font-num font-black text-[#DFB76C] hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Klik untuk gunakan semua sisa kuota"
                          >
                            <span>{formatRupiah(maxAvail)}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-[#DFB76C]/20 border border-[#DFB76C]/30 text-[#DFB76C]">
                              Gunakan
                            </span>
                          </button>
                        );
                      })()}
                    </div>
                  </>
                )}
                {!budgetAnalytics.isCustomCapacity && (
                  <p className="text-[10px] text-slate-400 italic">
                    💡 Mode Bebas: Anda bebas menentukan nominal berapapun untuk pos ini.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Limit Bulanan Baru (Rp)
                  </label>
                  {budgetLimit && !isNaN(parseInt(budgetLimit.replace(/\D/g, ''), 10)) && (
                    <span className="text-[11px] font-num font-black text-[#DFB76C]">
                      {formatRupiah(parseInt(budgetLimit.replace(/\D/g, ''), 10))}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="Masukkan nominal bebas (misal: 150000)"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2.5 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  autoFocus
                />

                {/* Validasi apakah melebihi budget bulan ini */}
                {(() => {
                  if (!budgetAnalytics.isCustomCapacity) return null;
                  const limitNum = parseInt(budgetLimit.replace(/\D/g, ''), 10) || 0;
                  const otherTotal = budgets
                    .filter((b) => b.id !== editingBudget.id)
                    .reduce((sum, b) => sum + b.monthlyLimit, 0);
                  const maxAvail = Math.max(0, budgetAnalytics.totalBudget - otherTotal);

                  if (limitNum > maxAvail) {
                    return (
                      <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 animate-in fade-in duration-200">
                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-red-300">
                          <p className="font-bold">Melebihi Sisa Budget Bulan Ini!</p>
                          <p className="text-[10px] text-red-300/80 mt-0.5">
                            Maksimal sisa kuota yang dapat dialokasikan adalah{' '}
                            <span className="font-bold text-white">{formatRupiah(maxAvail)}</span>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setBudgetLimit(maxAvail.toString())}
                            className="mt-1.5 text-[10px] font-bold text-white bg-red-500/40 hover:bg-red-500/60 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                          >
                            Sesuaikan ke {formatRupiah(maxAvail)}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[100000, 250000, 500000, 1000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBudgetLimit(amt.toString())}
                    className="py-1.5 px-1 text-center rounded-lg bg-white/5 hover:bg-white/10 hover:border-[#DFB76C]/40 text-[11px] text-slate-300 border border-white/5 cursor-pointer font-num font-bold transition-all"
                  >
                    {amt >= 1000000 ? `${amt / 1000000}Jt` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>

              {/* Edit Rincian Sub-Kategori Anggaran */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-[#DFB76C] uppercase tracking-wider flex items-center gap-1">
                    <Layers size={11} />
                    <span>Rincian Limit Sub-Kategori (Opsional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBudgetSubcategories((prev) => [
                        ...prev,
                        { id: `sub-${Date.now()}`, name: '', limit: 0 },
                      ]);
                    }}
                    className="text-[10px] text-[#DFB76C] hover:underline cursor-pointer"
                  >
                    + Tambah Sub
                  </button>
                </div>

                {editingBudgetSubcategories.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Belum ada sub-kategori untuk pos ini. Klik "+ Tambah Sub" untuk menentukan alokasi per sub-kategori.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {editingBudgetSubcategories.map((sub, sIdx) => (
                      <div key={sub.id || sIdx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingBudgetSubcategories((prev) =>
                              prev.map((item, idx) => (idx === sIdx ? { ...item, name: val } : item))
                            );
                          }}
                          placeholder="Nama sub (misal: Bensin)"
                          className="flex-1 rounded-lg bg-[#050B17] border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={sub.limit || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setEditingBudgetSubcategories((prev) =>
                              prev.map((item, idx) => (idx === sIdx ? { ...item, limit: val } : item))
                            );
                          }}
                          placeholder="Limit (Rp)"
                          className="w-28 rounded-lg bg-[#050B17] border border-white/10 px-2 py-1.5 text-xs text-white font-num font-bold placeholder:text-slate-600 focus:outline-none focus:border-[#DFB76C]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBudgetSubcategories((prev) => prev.filter((_, idx) => idx !== sIdx));
                          }}
                          className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-white/5 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteBudget(editingBudget.id);
                    setEditingBudget(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  <span>Hapus</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: UBAH KAPASITAS TOTAL BUDGET BULANAN
         ======================================================== */}
      {showEditCapacityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowEditCapacityModal(false)}
          />

          <div className="relative w-full max-w-sm rounded-3xl bg-[#080E1E] border border-white/10 p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-[#DFB76C]/15 text-[#DFB76C]">
                  <Target size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Ubah Kapasitas Total Budget</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditCapacityModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBudgetCapacity} className="space-y-3.5 py-3">
              <div>
                <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                  Tentukan batas maksimal total pengeluaran Anda dalam 1 bulan kalender ini.
                </p>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Kapasitas Total Budget (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  placeholder="Masukkan nominal kapasitas (contoh: 3000000)"
                  className="w-full rounded-xl bg-[#050B17] border border-white/10 px-3 py-2 text-xs text-white font-num font-bold focus:outline-none focus:border-[#DFB76C]"
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-2">
                {[2000000, 3500000, 5000000, 10000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCapacityInput(amt.toString())}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 border border-white/5 cursor-pointer font-num font-bold"
                  >
                    {amt >= 1000000 ? `${amt / 1000000}jt` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>

              {/* Pilihan Opsi Hitung Otomatis dari Total Pos */}
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <button
                  type="button"
                  onClick={handleResetBudgetCapacityToSum}
                  className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Gunakan Total Penjumlahan Pos ({formatRupiah(budgetAnalytics.sumItemsLimit)})</span>
                </button>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#DFB76C] text-[#080E1E] font-bold text-xs hover:brightness-105 active:scale-[0.99] transition-all shadow-md cursor-pointer"
                >
                  Simpan Kapasitas Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          TOAST NOTIFIKASI BERHASIL (MINIMALIS & ELEGAN)
         ======================================================== */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-[#080E1E]/95 border border-[#DFB76C]/60 text-white shadow-2xl shadow-black/80 text-xs font-bold animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
          <div className="w-5 h-5 rounded-full bg-[#DFB76C]/20 flex items-center justify-center shrink-0">
            <Check size={13} strokeWidth={3} className="text-[#DFB76C]" />
          </div>
          <span className="tracking-wide">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
