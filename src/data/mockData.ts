import { UserProfile, Wallet, Category, Transaction } from '../types/database';

export const mockUserProfile: UserProfile = {
  id: 'usr_firmansah_01',
  email: 'firmansah@mydompet.id',
  full_name: 'Firmansah',
  avatar_url: '',
  currency: 'IDR',
  created_at: '2026-01-01T00:00:00Z',
};

export const mockWallets: Wallet[] = [
  {
    id: 'wal_utama',
    user_id: 'usr_firmansah_01',
    name: 'Dompet Utama',
    type: 'bank',
    account_number: '•••• 8821',
    balance: 4250000,
    color: '#D4AF37',
    icon: 'Wallet',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

/**
 * Categories matching user brief:
 * PEMASUKAN: Gaji, Bonus, Usaha, Lainnya
 * PENGELUARAN: Makanan, Transportasi, Belanja, Tagihan, Pendidikan, Kesehatan, Hiburan, Lainnya
 */
export const mockCategories: Category[] = [
  // Pemasukan
  {
    id: 'cat_gaji',
    name: 'Gaji',
    type: 'income',
    color: '#D4AF37', // Champagne Gold
    icon: 'Briefcase',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_bonus',
    name: 'Bonus',
    type: 'income',
    color: '#DFB76C',
    icon: 'Award',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_usaha',
    name: 'Usaha',
    type: 'income',
    color: '#E5C365',
    icon: 'TrendingUp',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_lainnya_inc',
    name: 'Lainnya',
    type: 'income',
    color: '#C5A059',
    icon: 'PlusCircle',
    created_at: '2026-01-01T00:00:00Z',
  },

  // Pengeluaran
  {
    id: 'cat_makanan',
    name: 'Makanan',
    type: 'expense',
    color: '#E2E8F0',
    icon: 'Utensils',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_transportasi',
    name: 'Transportasi',
    type: 'expense',
    color: '#CBD5E1',
    icon: 'Car',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_belanja',
    name: 'Belanja',
    type: 'expense',
    color: '#94A3B8',
    icon: 'ShoppingBag',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_tagihan',
    name: 'Tagihan',
    type: 'expense',
    color: '#64748B',
    icon: 'Receipt',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_pendidikan',
    name: 'Pendidikan',
    type: 'expense',
    color: '#CBD5E1',
    icon: 'GraduationCap',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_kesehatan',
    name: 'Kesehatan',
    type: 'expense',
    color: '#E2E8F0',
    icon: 'HeartPulse',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_hiburan',
    name: 'Hiburan',
    type: 'expense',
    color: '#94A3B8',
    icon: 'Film',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat_lainnya_exp',
    name: 'Lainnya',
    type: 'expense',
    color: '#64748B',
    icon: 'MoreHorizontal',
    created_at: '2026-01-01T00:00:00Z',
  },
];

/**
 * Initial Mock Transactions:
 * Pemasukan: Rp 6.000.000 (Gaji 5.000.000 + Bonus 1.000.000)
 * Pengeluaran: Rp 1.750.000 (Makan 35.000 + Transport 20.000 + Belanja 850.000 + Tagihan 450.000 + Pendidikan 395.000)
 * Saldo = Rp 4.250.000
 */
export const mockTransactions: Transaction[] = [
  {
    id: 'trx_01',
    user_id: 'usr_firmansah_01',
    wallet_id: 'wal_utama',
    category_id: 'cat_gaji',
    type: 'income',
    amount: 5000000,
    description: 'Gaji',
    date: '2026-09-23', // Hari ini
    notes: 'Payroll bulanan',
    created_at: '2026-09-23T08:00:00Z',
  },
  {
    id: 'trx_02',
    user_id: 'usr_firmansah_01',
    wallet_id: 'wal_utama',
    category_id: 'cat_makanan',
    type: 'expense',
    amount: 35000,
    description: 'Makan',
    date: '2026-09-23', // Hari ini
    notes: 'Makan siang',
    created_at: '2026-09-23T12:30:00Z',
  },
  {
    id: 'trx_03',
    user_id: 'usr_firmansah_01',
    wallet_id: 'wal_utama',
    category_id: 'cat_transportasi',
    type: 'expense',
    amount: 20000,
    description: 'Transportasi',
    date: '2026-09-22', // Kemarin
    notes: 'Bensin & parkir',
    created_at: '2026-09-22T17:15:00Z',
  },
  {
    id: 'trx_04',
    user_id: 'usr_firmansah_01',
    wallet_id: 'wal_utama',
    category_id: 'cat_belanja',
    type: 'expense',
    amount: 850000,
    description: 'Belanja',
    date: '2026-09-21',
    notes: 'Kebutuhan bulanan',
    created_at: '2026-09-21T14:00:00Z',
  },
  {
    id: 'trx_05',
    user_id: 'usr_firmansah_01',
    wallet_id: 'wal_utama',
    category_id: 'cat_bonus',
    type: 'income',
    amount: 1000000,
    description: 'Bonus',
    date: '2026-09-20',
    notes: 'Insentif proyek',
    created_at: '2026-09-20T10:00:00Z',
  },
  {
    id: 'trx_06',
    user_id: 'usr_firmansah_01',
    wallet_id: 'wal_utama',
    category_id: 'cat_tagihan',
    type: 'expense',
    amount: 450000,
    description: 'Tagihan',
    date: '2026-09-20',
    notes: 'Internet & listrik',
    created_at: '2026-09-20T16:30:00Z',
  },
  {
    id: 'trx_07',
    user_id: 'usr_firmansah_01',
    wallet_id: 'wal_utama',
    category_id: 'cat_pendidikan',
    type: 'expense',
    amount: 395000,
    description: 'Pendidikan',
    date: '2026-09-18',
    notes: 'Buku & modul',
    created_at: '2026-09-18T11:00:00Z',
  },
];
