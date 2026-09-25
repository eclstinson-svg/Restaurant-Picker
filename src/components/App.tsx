"use client";

import { useState } from "react";
import { AccountBar } from "./AccountBar";
import { AccountProvider, useAccount } from "./AccountProvider";
import { History } from "./History";
import { Picker } from "./Picker";
import { Wishlist } from "./Wishlist";

const TABS = [
  { id: "pick", label: "Pick" },
  { id: "history", label: "Been there" },
  { id: "wishlist", label: "Saved" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function App() {
  return (
    <AccountProvider>
      <Screens />
    </AccountProvider>
  );
}

function Screens() {
  const { couple } = useAccount();
  const [tab, setTab] = useState<Tab>("pick");
  const current = couple ? tab : "pick"; // other tabs need a couple

  return (
    <div className="space-y-5">
      <AccountBar />

      {couple && (
        <nav className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-subtle p-1 text-sm font-medium">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={current === t.id ? "page" : undefined}
              className="rounded-lg py-2 text-muted transition-colors hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {/* Picker stays mounted (just hidden) so switching tabs keeps your current pick. */}
      <div hidden={current !== "pick"}>
        <Picker />
      </div>
      {current === "history" && <History />}
      {current === "wishlist" && <Wishlist />}
    </div>
  );
}
