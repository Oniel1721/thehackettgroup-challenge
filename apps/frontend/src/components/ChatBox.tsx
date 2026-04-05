"use client";

import {
  useOptimistic,
  useRef,
  useState,
  useTransition,
  useEffect,
} from "react";
import { Message, SendMessageResponse } from "@/types/chat";

interface ChatBoxProps {
  sessionId: string;
  initialMessages: Message[];
}

type ErrorBanner = "empty" | "expired" | "network" | null;

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return rtf.format(-seconds, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  return rtf.format(-hours, "hour");
}

export function ChatBox({ sessionId, initialMessages }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (_state: Message[], draft: Message[]) => draft,
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState<ErrorBanner>(null);
  const [turnCount, setTurnCount] = useState(
    Math.floor(initialMessages.length / 2),
  );
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimisticMessages]);

  async function handleSend() {
    const message = input.trim();
    if (!message) {
      setError("empty");
      return;
    }

    setError(null);
    setInput("");

    const now = Date.now();
    const optimisticUser: Message = {
      id: `optimistic-user-${now}`,
      role: "user",
      content: message,
      timestamp: now,
    };

    startTransition(async () => {
      // Show optimistic user bubble immediately
      addOptimistic([...messages, optimisticUser]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (res.status === 400) {
          setError("empty");
          // messages unchanged → optimistic bubble rolls back automatically
          return;
        }

        if (res.status === 404 || res.status === 410) {
          setError("expired");
          return;
        }

        if (!res.ok) {
          setError("network");
          return;
        }

        const data = (await res.json()) as SendMessageResponse;
        const ts = Date.now();

        const userMsg: Message = {
          id: `user-${ts}`,
          role: "user",
          content: message,
          timestamp: now,
        };
        const botMsg: Message = {
          id: `bot-${ts}`,
          role: "assistant",
          content: data.reply,
          timestamp: ts,
        };

        // Commit both messages — optimistic bubble is replaced cleanly
        setMessages((prev) => [...prev, userMsg, botMsg]);
        setTurnCount(data.turnIndex + 1);
      } catch {
        setError("network");
        // optimistic bubble rolls back since setMessages was not called
      }
    });
  }

  async function handleClearExpired() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.assign("/");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !isPending) handleSend();
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white select-none">
            👨‍🍳
          </span>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              Chef Assistant
            </h1>
            <p className="text-xs text-slate-500">
              Your personal cooking expert
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {turnCount} turn{turnCount !== 1 ? "s" : ""}
        </div>
      </header>

      {/* ── Error banners ── */}
      {error === "expired" && (
        <div className="flex shrink-0 items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
          <span>Your session has expired.</span>
          <button
            onClick={handleClearExpired}
            className="ml-4 rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200"
          >
            Start new session
          </button>
        </div>
      )}
      {error === "network" && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
          Connection lost, please retry.
        </div>
      )}

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {optimisticMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-3xl">
                🍳
              </div>
              <h2 className="text-base font-semibold text-slate-700">
                Ask me anything about cooking!
              </h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Recipes, techniques, substitutions — I&apos;m here to help.
              </p>
            </div>
          )}

          {optimisticMessages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <span
                  className={`flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold ${
                    isUser
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isUser ? "U" : "AI"}
                </span>

                <div
                  className={`flex max-w-[75%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "rounded-tr-sm bg-indigo-600 text-white"
                        : "rounded-tl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {formatRelativeTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {error === "empty" && (
            <p className="mb-2 text-xs text-red-500">
              Message cannot be empty.
            </p>
          )}

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 shadow-sm transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error === "empty") setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a recipe or technique…"
              disabled={isPending}
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={isPending || !input.trim()}
              aria-label="Send message"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
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
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
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
    </div>
  );
}
