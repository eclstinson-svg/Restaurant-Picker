"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMyCouple, listSaved, type Couple, type SavedPlace } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type User = { id: string; email: string };

type Account = {
  enabled: boolean; // false until Supabase keys are configured
  loading: boolean;
  user: User | null;
  couple: Couple | null;
  saved: SavedPlace[]; // this couple's visited / wishlisted / hidden places
  reloadCouple: () => Promise<void>;
  reloadSaved: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<Account | null>(null);

export function useAccount(): Account {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount must be used inside <AccountProvider>");
  return account;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(Boolean(supabase));
  const [user, setUser] = useState<User | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [saved, setSaved] = useState<SavedPlace[]>([]);

  // Load the couple (and their saved places) for whoever is signed in.
  const loadAccount = useCallback(async (u: User | null) => {
    setUser(u);
    if (!u) {
      setCouple(null);
      setSaved([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const c = await getMyCouple(u.id);
      setCouple(c);
      setSaved(c ? await listSaved(c.id) : []);
    } catch (e) {
      console.error("Couldn't load account", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Supabase tells us when someone signs in or out (and once at startup).
  useEffect(() => {
    if (!supabase) return;
    let first = true;
    let currentId: string | null = null;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null;
      if (!first && u?.id === currentId) return; // e.g. a token refresh: nothing changed
      first = false;
      currentId = u?.id ?? null;
      // Supabase advises not calling it from inside this callback, so defer.
      setTimeout(() => loadAccount(u), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadAccount]);

  const reloadCouple = useCallback(() => loadAccount(user), [loadAccount, user]);

  const reloadSaved = useCallback(async () => {
    if (couple) setSaved(await listSaved(couple.id));
  }, [couple]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return (
    <AccountContext.Provider
      value={{
        enabled: Boolean(supabase),
        loading,
        user,
        couple,
        saved,
        reloadCouple,
        reloadSaved,
        signOut,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
