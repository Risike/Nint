import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApiClient } from '../services/api';

export interface User {
  id: string;
  email: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  rating?: number;
  credits?: number;
  cosmetics?: {
    piece_skin?: string;
    name_color?: string;
    name_decoration?: string;
    profile_icon?: string;
    title?: string;
    theme?: string;
  };
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string, username: string | undefined, captchaToken: string) => Promise<{ requiresVerification: boolean; email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
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

  const login = async (identifier: string, pass: string) => {
    const res = await ApiClient.login({ identifier, password: pass });
    ApiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setIsGuest(false);
  };

  const register = async (email: string, pass: string, name: string, username: string | undefined, captchaToken: string) => {
    return ApiClient.register({ email, password: pass, displayName: name, username, captchaToken });
  };

  const verifyEmail = async (email: string, code: string) => {
    const res = await ApiClient.verifyEmail(email, code);
    ApiClient.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setIsGuest(false);
  };

  const logout = () => {
    // Revoke the session server-side before discarding the token locally.
    if (ApiClient.getToken()) {
      ApiClient.logout().catch(() => {});
    }
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
        verifyEmail,
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
