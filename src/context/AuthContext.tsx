import React, { createContext, useContext, useMemo, useState } from 'react';
import * as db from '@/db/db';
import * as meta from '@/db/meta';
import type { AppUser, UserRole } from '@/data/mockData';

// Authentication for the multi-shop app.
//   • Admins are global "owners" (meta store) — they sign in with email +
//     password and can switch between shops.
//   • Managers sign in with email + password against the ACTIVE shop.
//   • Cashiers sign in with phone + a numeric passcode against the active shop.
// An account's role decides what it can see: admins/managers get the full app,
// cashiers are limited to the checkout flow (see app/(app)/_layout.tsx).
export type Role = UserRole;

type Ok = { ok: true; user: AppUser };
type Err = { ok: false; error: string };
type SignInResult = Ok | Err;

type AuthState = {
  user: AppUser | null;
  role: Role | null;
  signInAdmin: (email: string, password: string) => Promise<SignInResult>;
  signInCashier: (phone: string, passcode: string) => Promise<SignInResult>;
  register: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<SignInResult>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  const value = useMemo<AuthState>(
    () => ({
      user,
      role: user?.role ?? null,
      signInAdmin: async (email, password) => {
        if (!email.trim() || !password) {
          return { ok: false, error: 'Enter your email and password.' };
        }
        try {
          // Global owner (admin) first, then a manager of the active shop.
          const authed =
            (await meta.authenticateOwner(email, password)) ??
            (await db.authenticateManager(email, password));
          if (!authed) return { ok: false, error: 'Invalid email or password.' };
          setUser(authed);
          return { ok: true, user: authed };
        } catch (e) {
          console.error('Admin sign-in failed', e);
          return { ok: false, error: 'Could not sign in. Please try again.' };
        }
      },
      signInCashier: async (phone, passcode) => {
        if (!phone.trim() || !passcode) {
          return { ok: false, error: 'Enter your phone number and passcode.' };
        }
        try {
          const authed = await db.authenticateCashier(phone, passcode);
          if (!authed) return { ok: false, error: 'Invalid phone number or passcode.' };
          setUser(authed);
          return { ok: true, user: authed };
        } catch (e) {
          console.error('Cashier sign-in failed', e);
          return { ok: false, error: 'Could not sign in. Please try again.' };
        }
      },
      register: async ({ name, email, phone, password }) => {
        if (!name.trim()) return { ok: false, error: 'Enter your name.' };
        if (!email.trim()) return { ok: false, error: 'Enter your email.' };
        if (password.length < 6) {
          return { ok: false, error: 'Password must be at least 6 characters.' };
        }
        try {
          const created = await meta.registerOwner({ name: name.trim(), email, phone, password });
          setUser(created);
          return { ok: true, user: created };
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          if (/unique/i.test(msg)) {
            return { ok: false, error: 'That email or phone number is already registered.' };
          }
          console.error('Registration failed', e);
          return { ok: false, error: 'Could not create the account. Please try again.' };
        }
      },
      signOut: () => setUser(null),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// Roles allowed to see the full back-office. Cashiers are limited to checkout.
export const isBackOffice = (role: Role | null) => role === 'admin' || role === 'manager';

export const roleLabel: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  cashier: 'Cashier',
};
