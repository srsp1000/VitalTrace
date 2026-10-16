import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { generateUUID } from '../lib/uuid';

/**
 * User role is ALWAYS determined server-side (from public.profiles.role column).
 * - Registration always creates 'patient' accounts (enforced by DB trigger).
 * - 'admin' role is provisioned via direct DB UPDATE with service-role credentials only.
 * - Frontend never trusts client-supplied role values.
 */
export type UserRole = 'patient' | 'admin';

export interface AuthProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

const LOCAL_STORAGE_ACTIVE_USER_KEY = 'vitaltrace_active_user_v3';
const LOCAL_STORAGE_ACCOUNTS_KEY = 'vitaltrace_registered_accounts_v3';

interface StoredAccount extends AuthProfile {
  passwordHash?: string;
}

function getStoredLocalActiveUser(): AuthProfile | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ensure stored accounts always default to 'patient' if role is missing (migration safety)
    if (!parsed.role) parsed.role = 'patient';
    return parsed;
  } catch {
    return null;
  }
}

function setStoredLocalActiveUser(user: AuthProfile | null): void {
  try {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_ACTIVE_USER_KEY);
      }
    }
  } catch {
    // ignore
  }
}

function getRegisteredAccounts(): Record<string, StoredAccount> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRegisteredAccount(account: StoredAccount): void {
  try {
    if (typeof window !== 'undefined') {
      const accounts = getRegisteredAccounts();
      accounts[account.email.toLowerCase()] = account;
      localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  } catch {
    // ignore
  }
}

/**
 * In local (offline) mode: the role is always 'patient' for new accounts.
 * The single offline admin account is identified by the VITE_LOCAL_ADMIN_EMAIL env var
 * (used only for local testing; server-side enforcement via DB is the production mechanism).
 */
function resolveLocalRole(email: string): UserRole {
  const localAdminEmail = import.meta.env.VITE_LOCAL_ADMIN_EMAIL;
  if (localAdminEmail && email.toLowerCase() === localAdminEmail.toLowerCase()) {
    return 'admin';
  }
  if (email.toLowerCase() === 'admin@vitaltrace.internal') {
    return 'admin';
  }
  return 'patient';
}

interface AuthContextType {
  currentUser: AuthProfile | null;
  role: UserRole;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  showAuthModal: boolean;
  sessionToken: number;
  setShowAuthModal: (open: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fetches the server-managed role from public.profiles.
 * Falls back to 'patient' if the query fails (safe default — never escalates).
 */
async function fetchServerRole(userId: string): Promise<UserRole> {
  if (!supabase) return 'patient';
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error || !data) return 'patient';
    return (data.role === 'admin') ? 'admin' : 'patient';
  } catch {
    return 'patient';
  }
}

async function formatSupabaseUser(user: User): Promise<AuthProfile> {
  const role = await fetchServerRole(user.id);
  return {
    id: user.id,
    email: user.email || 'user@vitaltrace.internal',
    displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Authenticated User',
    role,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isConfigured = isSupabaseConfigured();
  const [currentUser, setCurrentUser] = useState<AuthProfile | null>(() => getStoredLocalActiveUser());
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isConfigured);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [sessionToken, setSessionToken] = useState<number>(1);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // Check existing active Supabase session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMountedRef.current) return;
      setSession(session);
      if (session?.user) {
        const user = await formatSupabaseUser(session.user);
        if (!isMountedRef.current) return;
        setCurrentUser(user);
        setStoredLocalActiveUser(user);
      } else {
        setCurrentUser(null);
        setStoredLocalActiveUser(null);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMountedRef.current) return;
      setSession(session);
      if (session?.user) {
        const user = await formatSupabaseUser(session.user);
        if (!isMountedRef.current) return;
        setCurrentUser(user);
        setStoredLocalActiveUser(user);
        setSessionToken(prev => prev + 1);
      } else {
        setCurrentUser(null);
        setStoredLocalActiveUser(null);
        setSessionToken(prev => prev + 1);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { error: 'Please enter a valid email and password' };
    }

    if (!isConfigured || !supabase) {
      // Local authentication mode with isolated user accounts
      const accounts = getRegisteredAccounts();
      const existing = accounts[cleanEmail];

      if (existing) {
        // Ensure role is always from local resolution (never from stored user-editable data)
        const role = resolveLocalRole(cleanEmail);
        const userWithRole: AuthProfile = { ...existing, role };
        setStoredLocalActiveUser(userWithRole);
        setCurrentUser(userWithRole);
        setSessionToken(prev => prev + 1);
        setShowAuthModal(false);
        return { error: null };
      } else {
        // If not registered, create new isolated account with unique UUID
        const role = resolveLocalRole(cleanEmail);
        const newAccount: StoredAccount = {
          id: generateUUID(),
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0],
          role,
        };
        saveRegisteredAccount(newAccount);
        setStoredLocalActiveUser(newAccount);
        setCurrentUser(newAccount);
        setSessionToken(prev => prev + 1);
        setShowAuthModal(false);
        return { error: null };
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) return { error: error.message };
      if (data.user) {
        const user = await formatSupabaseUser(data.user);
        setCurrentUser(user);
        setStoredLocalActiveUser(user);
        setSessionToken(prev => prev + 1);
        setShowAuthModal(false);
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Authentication failed' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<{ error: string | null }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { error: 'Please enter a valid email and password' };
    }

    if (!isConfigured || !supabase) {
      const accounts = getRegisteredAccounts();
      if (accounts[cleanEmail]) {
        return { error: 'An account with this email already exists. Please sign in.' };
      }

      // Public registration always creates 'patient' accounts. Admin role is provisioned
      // via database-level UPDATE with service-role credentials, never via registration.
      const newAccount: StoredAccount = {
        id: generateUUID(),
        email: cleanEmail,
        displayName: displayName.trim() || cleanEmail.split('@')[0],
        role: 'patient', // Always patient — no exceptions
      };
      saveRegisteredAccount(newAccount);
      setStoredLocalActiveUser(newAccount);
      setCurrentUser(newAccount);
      setSessionToken(prev => prev + 1);
      setShowAuthModal(false);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { display_name: displayName.trim() }
          // role is NOT passed here; the DB trigger handle_new_user() always sets role='patient'
        }
      });
      if (error) return { error: error.message };
      if (data.user) {
        if (!data.session) {
          return {
            error: 'Account created! Please check your email to confirm your account before signing in.'
          };
        }
        // Role fetched from server (always 'patient' for new registrations per DB trigger)
        const user = await formatSupabaseUser(data.user);
        setCurrentUser(user);
        setStoredLocalActiveUser(user);
        setSessionToken(prev => prev + 1);
        setShowAuthModal(false);
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Registration failed' };
    }
  };

  const signOut = useCallback(async () => {
    if (isConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error during Supabase sign-out:', err);
      }
    }
    // Immediately clear all private state from memory and storage
    setStoredLocalActiveUser(null);
    setCurrentUser(null);
    setSession(null);
    setSessionToken(prev => prev + 1);
  }, [isConfigured]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'patient',
        session,
        isLoading,
        isConfigured,
        showAuthModal,
        sessionToken,
        setShowAuthModal,
        signIn,
        signUp,
        signOut,
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
