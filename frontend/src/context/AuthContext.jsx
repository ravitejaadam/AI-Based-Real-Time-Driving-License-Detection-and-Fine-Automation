import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

const STORAGE_TOKEN_KEY = 'traffic_auth_token';
const STORAGE_PROFILE_KEY = 'traffic_auth_profile';

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const restoreStoredSession = () => {
      console.log('AuthContext startup: restoring stored session if available');
      const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedProfile = localStorage.getItem(STORAGE_PROFILE_KEY);
      console.log('Stored token present:', !!storedToken);
      console.log('Stored profile present:', !!storedProfile);

      if (storedToken && storedProfile) {
        try {
          const parsedProfile = JSON.parse(storedProfile);
          console.log('Restored profile from localStorage:', parsedProfile);
          setUser(parsedProfile);
          setToken(storedToken);
        } catch (err) {
          console.error('Failed to parse stored profile, clearing storage:', err);
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          localStorage.removeItem(STORAGE_PROFILE_KEY);
        }
      } else {
        console.log('No stored auth session found on startup');
      }

      setLoading(false);
    };

    restoreStoredSession();
  }, []);

  // Monitor user state changes during login
  useEffect(() => {
    console.log('AuthContext user state changed:', { user: user?.id, userRole: user?.role, hasToken: !!token });
  }, [user, token]);

  const login = async (email, password) => {
    try {
      console.log('AuthContext.login() called');
      const response = await authService.login(email, password);
      console.log('authService.login() response:', response);
      const profile = response?.profile;
      const session = response?.session;
      const accessToken = session?.access_token;

      // Debug the full auth payload
      console.log('User:', profile);
      console.log('Session:', session);
      console.log('Profile:', profile);
      console.log('profile?.role:', profile?.role);
      console.log('profile?.status:', profile?.status);

      if (!profile || !accessToken) {
        console.error('Missing profile or accessToken');
        throw new Error('Login failed. Please try again.');
      }

      // Validate role (admin or super_admin only)
      if (!['admin', 'super_admin'].includes(profile.role)) {
        console.error('Invalid role:', profile.role);
        const errorMsg = 'User accounts cannot access the Traffic Monitoring System.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Validate status (active only)
      if (profile.status !== 'active') {
        console.error('Invalid status:', profile.status);
        const errorMsg = 'Account is disabled. Contact Super Administrator.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Store session securely
      console.log('Storing session and user state');
      console.log('About to call setUser with:', profile);
      console.log('About to call setToken with accessToken');
      localStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
      console.log('Stored token in localStorage');
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
      console.log('Stored profile in localStorage');
      setUser(profile);
      console.log('Called setUser()');
      setToken(accessToken);
      console.log('Called setToken()');
      setError(null);
      console.log('Called setError(null)');

      console.log('User authenticated:', { id: profile.id, name: profile.name, role: profile.role });
      return profile;
    } catch (err) {
      console.error('AuthContext.login() error:', err.message);
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      // Optional: Sign out from Supabase backend if you have a logout endpoint
      // await authService.logout(token);
    } catch (err) {
      console.warn('Supabase logout failed:', err.message);
    }

    // Clear all session data
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_PROFILE_KEY);
    sessionStorage.clear();
    setUser(null);
    setToken(null);
    setError(null);

    console.log('User logged out successfully');
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, error, login, logout, isSuperAdmin: user?.role === 'super_admin', isAdmin: ['super_admin', 'admin'].includes(user?.role) }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
