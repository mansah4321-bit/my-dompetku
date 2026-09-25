import { supabase } from '../lib/supabase';

export interface SubCategoryConfig {
  id: string;
  name: string;
  limit: number;
}

export interface BudgetItem {
  id: string;
  category: string;
  monthlyLimit: number;
  color?: string;
  subcategories?: SubCategoryConfig[];
}

export const BUDGET_TABLE_SQL = `-- SQL SCHEMA UNTUK SUPABASE
-- Jalankan script ini di menu "SQL Editor" pada Supabase Dashboard Anda:

-- 1. Tabel Pos Anggaran (Budgets)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    monthly_limit NUMERIC NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#DFB76C',
    subcategories JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, category)
);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Policy RLS agar user hanya bisa akses anggarannya sendiri
DROP POLICY IF EXISTS "Users can manage their own budgets" ON public.budgets;
CREATE POLICY "Users can manage their own budgets" 
ON public.budgets 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Tabel Pengaturan User (User Settings / Kapasitas Total)
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    budget_capacity NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own settings" ON public.user_settings;
CREATE POLICY "Users can manage their own settings"
ON public.user_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
`;

/**
 * Fetch budgets from Supabase
 */
export async function fetchBudgetsFromSupabase(userId: string): Promise<{
  budgets: BudgetItem[] | null;
  budgetCapacity: number | null;
  error?: string;
}> {
  if (!userId || userId === 'guest') {
    return { budgets: null, budgetCapacity: null };
  }

  try {
    // 1. Fetch budgets
    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // 2. Fetch budget capacity from user_settings (or fail silently)
    let capacity: number | null = null;
    try {
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('budget_capacity')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsData && settingsData.budget_capacity !== null && settingsData.budget_capacity !== undefined) {
        capacity = Number(settingsData.budget_capacity);
      }
    } catch (e) {
      // Ignored if user_settings doesn't exist
    }

    if (budgetError) {
      // PGRST204 or 42P01 means table does not exist yet
      return { budgets: null, budgetCapacity: capacity, error: budgetError.message };
    }

    if (budgetData && budgetData.length > 0) {
      const mapped: BudgetItem[] = budgetData.map((row: any) => {
        let parsedSubs: SubCategoryConfig[] = [];
        if (Array.isArray(row.subcategories)) {
          parsedSubs = row.subcategories;
        } else if (typeof row.subcategories === 'string') {
          try {
            parsedSubs = JSON.parse(row.subcategories);
          } catch {
            parsedSubs = [];
          }
        }

        return {
          id: String(row.id || `bdg-${row.category}`),
          category: row.category || row.kategori || 'Lainnya',
          monthlyLimit: Number(row.monthly_limit || row.limit || row.amount || 0),
          color: row.color || '#DFB76C',
          subcategories: parsedSubs,
        };
      });

      return { budgets: mapped, budgetCapacity: capacity };
    }

    return { budgets: [], budgetCapacity: capacity };
  } catch (err: any) {
    return { budgets: null, budgetCapacity: null, error: err?.message || 'Gagal terhubung ke Supabase' };
  }
}

/**
 * Sync a single budget item to Supabase (Upsert)
 */
export async function syncBudgetToSupabase(userId: string, budget: BudgetItem): Promise<{ success: boolean; error?: string }> {
  if (!userId || userId === 'guest') return { success: false };

  try {
    const payload = {
      user_id: userId,
      category: budget.category,
      monthly_limit: budget.monthlyLimit,
      color: budget.color,
      subcategories: budget.subcategories || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('budgets')
      .upsert(payload, { onConflict: 'user_id,category' });

    if (error) {
      console.warn('Supabase budget sync warning:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Bulk sync all budgets to Supabase
 */
export async function syncAllBudgetsToSupabase(
  userId: string,
  budgets: BudgetItem[],
  capacity: number | null
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!userId || userId === 'guest') return { success: false, count: 0 };

  try {
    let successCount = 0;
    let firstError: string | undefined = undefined;

    // 1. Sync all budget items
    if (budgets.length > 0) {
      const rows = budgets.map((b) => ({
        user_id: userId,
        category: b.category,
        monthly_limit: b.monthlyLimit,
        color: b.color,
        subcategories: b.subcategories || [],
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('budgets')
        .upsert(rows, { onConflict: 'user_id,category' });

      if (error) {
        firstError = error.message;
      } else {
        successCount = budgets.length;
      }
    }

    // 2. Sync capacity
    if (capacity !== null && capacity !== undefined) {
      try {
        await supabase
          .from('user_settings')
          .upsert(
            {
              user_id: userId,
              budget_capacity: capacity,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
      } catch (e) {
        // user_settings is optional
      }
    }

    return { success: !firstError, count: successCount, error: firstError };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message };
  }
}

/**
 * Delete a budget item from Supabase
 */
export async function deleteBudgetFromSupabase(userId: string, category: string): Promise<{ success: boolean; error?: string }> {
  if (!userId || userId === 'guest') return { success: false };

  try {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('category', category);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Sync budget capacity to Supabase
 */
export async function syncBudgetCapacityToSupabase(userId: string, capacity: number | null): Promise<void> {
  if (!userId || userId === 'guest') return;

  try {
    await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          budget_capacity: capacity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
  } catch {
    // Non-blocking
  }
}
