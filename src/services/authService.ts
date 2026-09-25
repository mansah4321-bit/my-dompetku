import { UserProfile } from '../types/database';
import { mockUserProfile } from '../data/mockData';

const AUTH_STORAGE_KEY = 'mydompet_auth_user';

export interface AuthSession {
  user: UserProfile | null;
  isAuthenticated: boolean;
}

/**
 * Authentication Service (Supabase Ready)
 * Once Supabase is connected, replace localStorage calls with:
 * supabase.auth.signUp(), supabase.auth.signInWithPassword(), supabase.auth.signOut()
 */
export const authService = {
  async getSession(): Promise<AuthSession> {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const user = JSON.parse(stored) as UserProfile;
        return { user, isAuthenticated: true };
      }
    } catch (e) {
      console.error('Error reading auth session:', e);
    }
    // Default to Firmansah profile
    return { user: mockUserProfile, isAuthenticated: true };
  },

  async login(email: string, _password: string): Promise<UserProfile> {
    // In mock mode, emulate auth success
    const user: UserProfile = {
      ...mockUserProfile,
      email: email || mockUserProfile.email,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  async register(fullName: string, email: string, _password: string): Promise<UserProfile> {
    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      full_name: fullName,
      email: email,
      currency: 'IDR',
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  },

  async logout(): Promise<void> {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const current = (await this.getSession()).user || mockUserProfile;
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },
};
