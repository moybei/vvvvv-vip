"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";

export function MobileUserMenu({ email }: { email: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!email) return null;

  return (
    <div ref={containerRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-foreground/70 hover:bg-surface-muted dark:border-white/15"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-black/5 bg-surface p-3 shadow-lg dark:border-white/10">
          <p className="mb-2 truncate text-xs text-foreground/50">{email}</p>
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
