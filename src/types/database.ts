/**
 * Supabase Database Schema Types for MYDOMPET
 * Designed to mirror PostgreSQL tables in Supabase:
 * - profiles (auth.users extension)
 * - wallets (accounts: bank, cash, e-wallet)
 * - categories (income & expense categories)
 * - transactions (financial records)
 * - budgets (monthly limits per category)
 */

export type TransactionType = 'income' | 'expense';

export type WalletType = 'bank' | 'cash' | 'e-wallet' | 'investment' | 'other';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  currency: 'IDR' | 'USD' | 'EUR' | 'MYR' | 'SGD';
  created_at: string;
  updated_at?: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  type: WalletType;
  account_number?: string;
  balance: number;
  color: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id?: string; // null if default system category
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  monthly_budget?: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id?: string;
  category_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  title?: string; // Optional compatibility alias
  date: string; // ISO date string YYYY-MM-DD
  notes?: string;
  payee_payer?: string;
  receipt_url?: string;
  created_at: string;
  updated_at?: string;
  // Joined virtual fields for display
  wallet?: Wallet;
  category?: Category;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  month: string; // YYYY-MM
  created_at: string;
  category?: Category;
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number; // percentage (0 - 100)
  transactionCount: number;
}

export interface TransactionFilter {
  searchQuery?: string;
  type?: 'all' | 'income' | 'expense';
  categoryId?: string;
  walletId?: string;
  startDate?: string;
  endDate?: string;
  month?: string; // YYYY-MM
}

export type ActiveNavTab = 'beranda' | 'transaksi' | 'kategori';
