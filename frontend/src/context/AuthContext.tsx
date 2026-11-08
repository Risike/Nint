import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApiClient } from '../services/api';

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  rating?: number;
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  playAsGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(ApiClient.getToken());
  const [isGuest, setIsGuest] = useState<boolean>(!ApiClient.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await ApiClient.getMe();
          setUser(profile);
          setIsGuest(false);
        } catch (e) {
          console.warn('Failed to restore session:', e);
          ApiClient.setToken(null);
          setToken(null);
          setIsGuest(true);
        }
      } else {
        setIsGuest(true);
      }
      setIsLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, pass: string) => {
    const res = await ApiClient.login({ email, password: pass });
    ApiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setIsGuest(false);
  };

  const register = async (email: string, pass: string, name: string) => {
    const res = await ApiClient.register({ email, password: pass, displayName: name });
    ApiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setIsGuest(false);
  };

  const logout = () => {
    ApiClient.setToken(null);
    setToken(null);
    setUser(null);
    setIsGuest(true);
  };

  const playAsGuest = () => {
    logout();
    setIsGuest(true);
  };

  const refreshProfile = async () => {
    if (token) {
      const profile = await ApiClient.getMe();
      setUser(profile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isGuest,
        isLoading,
        login,
        register,
        logout,
        playAsGuest,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
