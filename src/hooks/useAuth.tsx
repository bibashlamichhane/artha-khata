import React, { useState, useEffect, createContext, useContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  idbGetProfile,
  idbSaveProfile,
  idbGetSettings,
  idbSaveSettings,
} from '@/lib/indexeddb';
import type { UserProfile, UserSettings } from '@/types/khata';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  settings: UserSettings | null;
  isLoading: boolean;
  isDemoUser: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; requiresConfirmation?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USER_ID = 'demo-user-khata-0001';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);

  // Sync profile & settings for user
  const initUserData = async (uid: string, nameFallback: string = 'User') => {
    try {
      let currentProfile = await idbGetProfile(uid);
      if (!currentProfile) {
        if (isSupabaseConfigured && navigator.onLine) {
          const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
          if (data) currentProfile = data;
        }
      }

      if (!currentProfile) {
        currentProfile = {
          id: uid,
          name: nameFallback,
          photo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await idbSaveProfile(currentProfile);
      }
      setProfile(currentProfile);

      let currentSettings = await idbGetSettings(uid);
      if (!currentSettings) {
        if (isSupabaseConfigured && navigator.onLine) {
          const { data } = await supabase.from('user_settings').select('*').eq('user_id', uid).single();
          if (data) currentSettings = data;
        }
      }

      if (!currentSettings) {
        currentSettings = {
          id: crypto.randomUUID(),
          user_id: uid,
          currency: 'NPR',
          company_name: 'KHATA Financials',
          company_logo_url: null,
          theme: 'light',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await idbSaveSettings(currentSettings);
      }
      setSettings(currentSettings);
    } catch (e) {
      console.error('Error initializing user profile/settings:', e);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Check for stored demo mode
    const storedDemo = localStorage.getItem('khata_demo_mode');
    if (storedDemo === 'true') {
      setIsDemoUser(true);
      const mockUser = {
        id: DEMO_USER_ID,
        email: 'owner@khata.app',
        user_metadata: { name: 'Account Owner' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;
      setUser(mockUser);
      initUserData(DEMO_USER_ID, 'Account Owner').then(() => {
        if (mounted) setIsLoading(false);
      });
      return;
    }

    // 2. Check Supabase auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        initUserData(
          session.user.id,
          session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Account Owner'
        ).then(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        initUserData(
          session.user.id,
          session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Account Owner'
        );
      } else if (!isDemoUser) {
        setProfile(null);
        setSettings(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoUser]);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      localStorage.removeItem('khata_demo_mode');
      setIsDemoUser(false);
      setUser(data.user);
      setSession(data.session);
      if (data.user) {
        await initUserData(data.user.id, data.user.user_metadata?.name || email.split('@')[0]);
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Unable to sign in. Please try again.' };
    }
  };

  const signUp = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ error?: string; requiresConfirmation?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      if (error) return { error: error.message };

      if (data.user && !data.session) {
        return { requiresConfirmation: true };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        await initUserData(data.user.id, name);
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Unable to sign up.' };
    }
  };

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message || 'Unable to send password reset instructions.' };
    }
  };

  const signOut = async (): Promise<void> => {
    localStorage.removeItem('khata_demo_mode');
    setIsDemoUser(false);
    setUser(null);
    setSession(null);
    setProfile(null);
    setSettings(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Offline fallback
    }
  };

  const enterDemoMode = () => {
    localStorage.setItem('khata_demo_mode', 'true');
    setIsDemoUser(true);
    const mockUser = {
      id: DEMO_USER_ID,
      email: 'owner@khata.app',
      user_metadata: { name: 'Bikram Giri' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;
    setUser(mockUser);
    initUserData(DEMO_USER_ID, 'Bikram Giri');
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated: UserProfile = {
      ...profile,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    setProfile(updated);
    await idbSaveProfile(updated);

    if (!isDemoUser && isSupabaseConfigured && navigator.onLine) {
      await supabase.from('profiles').upsert(updated);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!settings) return;
    const updated: UserSettings = {
      ...settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    setSettings(updated);
    await idbSaveSettings(updated);

    if (!isDemoUser && isSupabaseConfigured && navigator.onLine) {
      await supabase.from('user_settings').upsert(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        settings,
        isLoading,
        isDemoUser,
        signIn,
        signUp,
        resetPassword,
        signOut,
        enterDemoMode,
        updateProfile,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
