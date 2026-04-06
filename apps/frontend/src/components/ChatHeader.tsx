"use client";

import { useChat } from "@/context/ChatContext";

export function ChatHeader() {
  const { turnCount } = useChat();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white select-none">
          👨‍🍳
        </span>
        <div>
          <h1 className="text-sm font-semibold text-slate-900">
            Chef Assistant
          </h1>
          <p className="text-xs text-slate-500">Your personal cooking expert</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {turnCount} turn{turnCount !== 1 ? "s" : ""}
      </div>
    </header>
  );
}
