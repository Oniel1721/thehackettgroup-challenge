"use client";

import { useChat } from "@/context/ChatContext";

export function ChatInput() {
  const { sessionId, input, setInput, sendMessage, isPending, error, clearError } =
    useChat();

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !isPending) sendMessage();
  }

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {error === "empty" && (
          <p className="mb-2 text-xs text-red-500">Message cannot be empty.</p>
        )}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error === "empty") clearError();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a recipe or technique…"
            disabled={isPending}
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isPending || !input.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          Press Enter or click Send · Session:{" "}
          <span className="font-mono">{sessionId.slice(0, 8)}…</span>
        </p>
      </div>
    </div>
  );
}
