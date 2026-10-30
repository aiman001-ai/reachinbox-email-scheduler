import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loginWithGoogleSuccess: (credentialResponse: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'reachinbox_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user?.email) {
      api
        .syncUser(user)
        .then((res) => {
          if (res?.user?.id && res.user.id !== user.id) {
            const updated = { ...user, id: res.user.id };
            setUser(updated);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          }
        })
        .catch((err) => {
          console.error('Background user sync error:', err);
        });
    }
  }, []);

  const parseJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  const loginWithGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      const payload = parseJwt(credentialResponse.credential);
      if (payload) {
        let profile: UserProfile = {
          id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          avatar: payload.picture,
        };

        try {
          const syncRes = await api.syncUser(profile);
          if (syncRes?.user?.id) {
            profile = {
              ...profile,
              id: syncRes.user.id,
            };
          }
        } catch (e) {
          console.error('Failed to sync user with database:', e);
        }

        setUser(profile);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      }
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loginWithGoogleSuccess,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
