import { Transaction, FinancialSummary, Wallet } from '../types/database';

/**
 * Calculate financial totals: total balance, income, expense, and savings rate
 */
export function calculateFinancialSummary(
  transactions: Transaction[],
  wallets: Wallet[] = []
): FinancialSummary {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }
  }

  const netSavings = totalIncome - totalExpense;
  const totalBalance = netSavings;
  const savingsRate = totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;

  return {
    totalBalance,
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
    transactionCount: transactions.length,
  };
}

export interface CategorySummaryItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  totalAmount: number;
  count: number;
  percentage: number;
}

/**
 * Group expenses or income by category
 */
export function groupTransactionsByCategory(
  transactions: Transaction[],
  type: 'income' | 'expense' = 'expense'
): CategorySummaryItem[] {
  const filtered = transactions.filter((t) => t.type === type);
  const totalSum = filtered.reduce((acc, t) => acc + t.amount, 0);

  const categoryMap = new Map<string, {
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
    totalAmount: number;
    count: number;
  }>();

  for (const t of filtered) {
    const catId = t.category_id || 'unknown';
    const catName = t.category?.name || 'Lainnya';
    const catColor = t.category?.color || '#64748B';
    const catIcon = t.category?.icon || 'Tag';

    const existing = categoryMap.get(catId);
    if (existing) {
      existing.totalAmount += t.amount;
      existing.count += 1;
    } else {
      categoryMap.set(catId, {
        categoryName: catName,
        categoryColor: catColor,
        categoryIcon: catIcon,
        totalAmount: t.amount,
        count: 1,
      });
    }
  }

  const result: CategorySummaryItem[] = [];
  categoryMap.forEach((val, catId) => {
    result.push({
      categoryId: catId,
      categoryName: val.categoryName,
      categoryColor: val.categoryColor,
      categoryIcon: val.categoryIcon,
      totalAmount: val.totalAmount,
      count: val.count,
      percentage: totalSum > 0 ? (val.totalAmount / totalSum) * 100 : 0,
    });
  });

  return result.sort((a, b) => b.totalAmount - a.totalAmount);
}

export interface MonthlyTrendItem {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "Apr 26"
  income: number;
  expense: number;
  net: number;
}

/**
 * Get monthly trend aggregation for the last N months
 */
export function getMonthlyTrends(transactions: Transaction[], monthsBack: number = 6): MonthlyTrendItem[] {
  const now = new Date();
  const months: { key: string; label: string }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short' });
    months.push({ key, label });
  }

  const map = new Map<string, { income: number; expense: number }>();
  months.forEach((m) => map.set(m.key, { income: 0, expense: 0 }));

  for (const t of transactions) {
    const tMonth = t.date.substring(0, 7);
    if (map.has(tMonth)) {
      const data = map.get(tMonth)!;
      if (t.type === 'income') {
        data.income += t.amount;
      } else {
        data.expense += t.amount;
      }
    }
  }

  return months.map((m) => {
    const entry = map.get(m.key) || { income: 0, expense: 0 };
    return {
      monthKey: m.key,
      monthLabel: m.label,
      income: entry.income,
      expense: entry.expense,
      net: entry.income - entry.expense,
    };
  });
}
