"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem("writer-theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
  }, []);

  function updateTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    localStorage.setItem("writer-theme", nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <main className={isDark ? "min-h-screen bg-[#0b0b0f] text-white" : "min-h-screen bg-[#f5f5f7] text-[#1d1d1f]"}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-400">
              Writer
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight">Settings</h1>
          </div>

          <Link
            href="/"
            className={isDark ? "rounded-full bg-[#15151a] px-6 py-3 text-sm font-bold shadow-sm ring-1 ring-white/10" : "rounded-full bg-white px-6 py-3 text-sm font-bold shadow-sm"}
          >
            Back to Studio
          </Link>
        </header>

        <section className={isDark ? "rounded-[2rem] bg-[#15151a] p-8 shadow-sm ring-1 ring-white/10" : "rounded-[2rem] bg-white p-8 shadow-sm"}>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Appearance
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Theme</h2>
          <p className="mt-2 text-zinc-500">
            Choose how Writer looks while you work.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => updateTheme("light")}
              className={
                theme === "light"
                  ? "rounded-[2rem] border-2 border-[#007aff] bg-white p-6 text-left shadow-sm"
                  : isDark
                    ? "rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left"
                    : "rounded-[2rem] border border-zinc-200 bg-[#fbfbfd] p-6 text-left"
              }
            >
              <div className="mb-6 h-32 rounded-[1.5rem] bg-[#f5f5f7] p-4">
                <div className="mb-3 h-5 w-24 rounded-full bg-white" />
                <div className="h-16 rounded-2xl bg-white" />
              </div>
              <p className="text-xl font-semibold">Light</p>
              <p className="mt-1 text-sm text-zinc-500">Clean daytime studio look.</p>
            </button>

            <button
              onClick={() => updateTheme("dark")}
              className={
                theme === "dark"
                  ? "rounded-[2rem] border-2 border-[#007aff] bg-[#101014] p-6 text-left shadow-sm"
                  : isDark
                    ? "rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left"
                    : "rounded-[2rem] border border-zinc-200 bg-[#fbfbfd] p-6 text-left"
              }
            >
              <div className="mb-6 h-32 rounded-[1.5rem] bg-[#0b0b0f] p-4">
                <div className="mb-3 h-5 w-24 rounded-full bg-[#23232a]" />
                <div className="h-16 rounded-2xl bg-[#23232a]" />
              </div>
              <p className="text-xl font-semibold">Dark</p>
              <p className="mt-1 text-sm text-zinc-500">Low-light writing mode.</p>
            </button>
          </div>

          <div className={isDark ? "mt-8 rounded-2xl bg-white/10 px-5 py-4 text-sm text-zinc-300" : "mt-8 rounded-2xl bg-[#f5f5f7] px-5 py-4 text-sm text-zinc-500"}>
            Current theme: <span className="font-semibold">{theme}</span>
          </div>
        </section>
      </div>
    </main>
  );
}