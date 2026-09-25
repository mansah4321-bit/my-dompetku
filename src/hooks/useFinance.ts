import { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Wallet, Category, TransactionFilter, FinancialSummary, TransactionType } from '../types/database';
import { financeService } from '../services/financeService';
import { categoryService } from '../services/categoryService';
import { calculateFinancialSummary } from '../utils/calculations';

export function useFinance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<TransactionFilter>({
    type: 'all',
    searchQuery: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedTx, fetchedWallets, fetchedCats] = await Promise.all([
        financeService.getTransactions(filter),
        financeService.getWallets(),
        categoryService.getCategories(),
      ]);
      setTransactions(fetchedTx);
      setWallets(fetchedWallets);
      setCategories(fetchedCats);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Overall summary based on all wallets and current filtered/all transactions
  const summary: FinancialSummary = useMemo(() => {
    return calculateFinancialSummary(transactions, wallets);
  }, [transactions, wallets]);

  // Actions
  const addTransaction = async (
    payload: Omit<Transaction, 'id' | 'created_at' | 'wallet' | 'category'>
  ) => {
    const created = await financeService.createTransaction(payload);
    await loadData();
    return created;
  };

  const updateTransaction = async (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'wallet' | 'category'>>
  ) => {
    const updated = await financeService.updateTransaction(id, updates);
    await loadData();
    return updated;
  };

  const deleteTransaction = async (id: string) => {
    await financeService.deleteTransaction(id);
    await loadData();
  };

  const addCategory = async (payload: {
    name: string;
    type: TransactionType;
    color: string;
    icon: string;
    monthly_budget?: number;
  }) => {
    const created = await categoryService.addCategory(payload);
    await loadData();
    return created;
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const updated = await categoryService.updateCategory(id, updates);
    await loadData();
    return updated;
  };

  const deleteCategory = async (id: string) => {
    await categoryService.deleteCategory(id);
    await loadData();
  };

  const addWallet = async (payload: Omit<Wallet, 'id' | 'created_at'>) => {
    const created = await financeService.createWallet(payload);
    await loadData();
    return created;
  };

  const updateWallet = async (id: string, updates: Partial<Wallet>) => {
    const updated = await financeService.updateWallet(id, updates);
    await loadData();
    return updated;
  };

  const resetAllData = async () => {
    await financeService.resetData();
    await loadData();
  };

  return {
    transactions,
    wallets,
    categories,
    summary,
    isLoading,
    filter,
    setFilter,
    loadData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addWallet,
    updateWallet,
    resetAllData,
  };
}
