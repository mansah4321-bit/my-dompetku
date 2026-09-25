import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types/database';
import { authService } from '../services/authService';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = await authService.getSession();
      setUser(session.user);
      setIsAuthenticated(session.isAuthenticated);
    } catch (e) {
      console.error('Failed to get session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, pass: string) => {
    const loggedUser = await authService.login(email, pass);
    setUser(loggedUser);
    setIsAuthenticated(true);
    return loggedUser;
  };

  const register = async (name: string, email: string, pass: string) => {
    const regUser = await authService.register(name, email, pass);
    setUser(regUser);
    setIsAuthenticated(true);
    return regUser;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const updated = await authService.updateProfile(updates);
    setUser(updated);
    return updated;
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    refreshSession: checkSession,
  };
}
