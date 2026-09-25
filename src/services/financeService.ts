import { Transaction, Wallet, TransactionFilter, Category } from '../types/database';
import { mockTransactions, mockWallets } from '../data/mockData';
import { categoryService } from './categoryService';

/**
 * Finance Service (Supabase Integration Ready)
 * 
 * In this preview phase, data is managed in-memory for seamless UI demonstration.
 * In the next phase, each method maps directly to Supabase client calls:
 * e.g., const { data, error } = await supabase.from('transactions').select('*, category:categories(*)')
 */

// In-memory runtime state for preview
let runtimeTransactions: Transaction[] = [...mockTransactions];
let runtimeWallets: Wallet[] = [...mockWallets];

export const financeService = {
  // =================== WALLETS ===================
  async getWallets(): Promise<Wallet[]> {
    return [...runtimeWallets];
  },

  async getPrimaryWallet(): Promise<Wallet> {
    return runtimeWallets[0] || mockWallets[0];
  },

  // =================== TRANSACTIONS ===================
  async getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    const categories = await categoryService.getCategories();
    const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
    const primaryWallet = runtimeWallets[0] || mockWallets[0];

    let hydrated: Transaction[] = runtimeTransactions.map((t) => ({
      ...t,
      category: catMap.get(t.category_id),
      wallet: primaryWallet,
    }));

    if (filter) {
      if (filter.type && filter.type !== 'all') {
        hydrated = hydrated.filter((t) => t.type === filter.type);
      }
      if (filter.categoryId && filter.categoryId !== 'all') {
        hydrated = hydrated.filter((t) => t.category_id === filter.categoryId);
      }
      if (filter.searchQuery && filter.searchQuery.trim() !== '') {
        const query = filter.searchQuery.toLowerCase().trim();
        hydrated = hydrated.filter(
          (t) =>
            t.description.toLowerCase().includes(query) ||
            (t.notes && t.notes.toLowerCase().includes(query)) ||
            (t.category?.name && t.category.name.toLowerCase().includes(query))
        );
      }
    }

    // Sort by date descending
    return hydrated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async createTransaction(
    payload: Omit<Transaction, 'id' | 'created_at' | 'wallet' | 'category'>
  ): Promise<Transaction> {
    const newTransaction: Transaction = {
      ...payload,
      id: `trx_${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    runtimeTransactions = [newTransaction, ...runtimeTransactions];

    // Update wallet balance in memory
    const delta = payload.type === 'income' ? payload.amount : -payload.amount;
    if (runtimeWallets.length > 0) {
      runtimeWallets[0] = {
        ...runtimeWallets[0],
        balance: runtimeWallets[0].balance + delta,
      };
    }

    const categories = await categoryService.getCategories();
    return {
      ...newTransaction,
      category: categories.find((c) => c.id === newTransaction.category_id),
      wallet: runtimeWallets[0],
    };
  },

  async updateTransaction(
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'wallet' | 'category'>>
  ): Promise<Transaction> {
    const idx = runtimeTransactions.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Transaction ${id} not found`);

    const oldTx = runtimeTransactions[idx];
    const newTx: Transaction = {
      ...oldTx,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Update wallet balance if amount or type changed
    if (updates.amount !== undefined || updates.type !== undefined) {
      const oldDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
      const newDelta = newTx.type === 'income' ? newTx.amount : -newTx.amount;
      if (runtimeWallets.length > 0) {
        runtimeWallets[0] = {
          ...runtimeWallets[0],
          balance: runtimeWallets[0].balance + oldDelta + newDelta,
        };
      }
    }

    runtimeTransactions[idx] = newTx;
    const categories = await categoryService.getCategories();
    return {
      ...newTx,
      category: categories.find((c) => c.id === newTx.category_id),
      wallet: runtimeWallets[0],
    };
  },

  async createWallet(payload: Omit<Wallet, 'id' | 'created_at'>): Promise<Wallet> {
    const newWallet: Wallet = {
      ...payload,
      id: `wal_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    runtimeWallets = [...runtimeWallets, newWallet];
    return newWallet;
  },

  async updateWallet(id: string, updates: Partial<Wallet>): Promise<Wallet> {
    const idx = runtimeWallets.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Wallet ${id} not found`);
    const updated = { ...runtimeWallets[idx], ...updates };
    runtimeWallets[idx] = updated;
    return updated;
  },

  async deleteTransaction(id: string): Promise<void> {
    const oldTx = runtimeTransactions.find((t) => t.id === id);
    if (oldTx && runtimeWallets.length > 0) {
      const delta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
      runtimeWallets[0] = {
        ...runtimeWallets[0],
        balance: runtimeWallets[0].balance + delta,
      };
    }
    runtimeTransactions = runtimeTransactions.filter((t) => t.id !== id);
  },

  async resetData(): Promise<void> {
    runtimeTransactions = [...mockTransactions];
    runtimeWallets = [...mockWallets];
  },
};
