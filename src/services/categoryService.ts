import { Category, TransactionType } from '../types/database';
import { mockCategories } from '../data/mockData';

/**
 * Category Service (Supabase Integration Ready)
 * 
 * In this preview phase, data is managed in-memory.
 * Later maps to: const { data, error } = await supabase.from('categories').select('*')
 */

let runtimeCategories: Category[] = [...mockCategories];

export const categoryService = {
  async getCategories(type?: TransactionType): Promise<Category[]> {
    if (type) {
      return runtimeCategories.filter((c) => c.type === type);
    }
    return [...runtimeCategories];
  },

  async addCategory(payload: {
    name: string;
    type: TransactionType;
    color?: string;
    icon?: string;
  }): Promise<Category> {
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: payload.name,
      type: payload.type,
      color: payload.color || (payload.type === 'income' ? '#D4AF37' : '#94A3B8'),
      icon: payload.icon || (payload.type === 'income' ? 'TrendingUp' : 'Tag'),
      created_at: new Date().toISOString(),
    };

    runtimeCategories = [newCategory, ...runtimeCategories];
    return newCategory;
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const idx = runtimeCategories.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Category ${id} not found`);
    const updated = { ...runtimeCategories[idx], ...updates };
    runtimeCategories[idx] = updated;
    return updated;
  },

  async deleteCategory(id: string): Promise<void> {
    runtimeCategories = runtimeCategories.filter((c) => c.id !== id);
  },

  async resetDefaultCategories(): Promise<Category[]> {
    runtimeCategories = [...mockCategories];
    return runtimeCategories;
  },
};
