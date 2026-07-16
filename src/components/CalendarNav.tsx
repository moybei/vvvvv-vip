"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { format, isValid, parseISO } from "date-fns";
import { todayInMalaysia } from "@/lib/datetime";

export function CalendarNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const dateParam = searchParams.get("date");
  const today = todayInMalaysia();
  const selectedStr = dateParam && isValid(parseISO(dateParam)) ? dateParam : today;
  const selected = parseISO(selectedStr);
  const isToday = selectedStr === today;

  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(selected);
  const [daysWithEntries, setDaysWithEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    const monthStr = format(month, "yyyy-MM");
    let cancelled = false;

    fetch(`/api/violations/summary?month=${monthStr}`)
      .then((r) => r.json())
      .then((data: { dates: string[] }) => {
        if (!cancelled) setDaysWithEntries(new Set(data.dates));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [month]);

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

  const goToDate = useCallback(
    (date: Date) => {
      router.push(`/?date=${format(date, "yyyy-MM-dd")}`);
      setIsOpen(false);
    },
    [router],
  );

  const hasEntry = useMemo(
    () => (date: Date) => daysWithEntries.has(format(date, "yyyy-MM-dd")),
    [daysWithEntries],
  );

  return (
    <div ref={containerRef} className="vip-calendar relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-black/5 bg-surface px-4 py-3 text-left shadow-sm transition hover:bg-surface-muted dark:border-white/10 sm:w-auto"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <span className="font-semibold">
            {isToday ? "Today" : format(selected, "EEEE, d MMMM yyyy")}
          </span>
          {!isToday && (
            <span className="text-sm text-foreground/45">{format(selected, "EEE, d MMM")}</span>
          )}
        </span>
        <span className="text-xs text-foreground/45">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-2 rounded-2xl border border-black/5 bg-surface p-3 shadow-lg dark:border-white/10">
          <DayPicker
            mode="single"
            required
            selected={selected}
            onSelect={goToDate}
            month={month}
            onMonthChange={setMonth}
            showOutsideDays
            modifiers={{ hasEntry }}
            modifiersClassNames={{ hasEntry: "rdp-has-entry" }}
          />
          {!isToday && (
            <button
              type="button"
              onClick={() => {
                router.push(`/?date=${today}`);
                setIsOpen(false);
              }}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-center text-sm font-medium text-brand-red hover:bg-brand-red/5"
            >
              Back to today
            </button>
          )}
        </div>
      )}
    </div>
  );
}
