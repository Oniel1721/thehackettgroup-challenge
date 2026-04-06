"use client";

import {
  createContext,
  useContext,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { Message } from "@/types/chat";

export type ErrorBanner = "empty" | "expired" | "network" | "ratelimit" | null;

interface ChatState {
  sessionId: string;
  optimisticMessages: Message[];
  streamingContent: string | null;
  error: ErrorBanner;
  turnCount: number;
  input: string;
  isPending: boolean;
  setInput: (v: string) => void;
  clearError: () => void;
  sendMessage: () => void;
  handleClearExpired: () => Promise<void>;
}

const ChatContext = createContext<ChatState | null>(null);

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

interface ChatProviderProps {
  sessionId: string;
  initialMessages: Message[];
  children: React.ReactNode;
}

export function ChatProvider({
  sessionId,
  initialMessages,
  children,
}: ChatProviderProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (_state: Message[], draft: Message[]) => draft,
  );
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<ErrorBanner>(null);
  const [turnCount, setTurnCount] = useState(
    Math.floor(initialMessages.length / 2),
  );
  const [isPending, startTransition] = useTransition();

  function clearError() {
    setError(null);
  }

  function sendMessage() {
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
      addOptimistic([...messages, optimisticUser]);
      setStreamingContent("");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (
          !res.ok ||
          res.headers.get("content-type")?.includes("application/json")
        ) {
          if (res.status === 429) {
            setError("ratelimit");
            setStreamingContent(null);
            return;
          }
          const data = await res.json();
          setError(data.sessionExpired ? "expired" : "network");
          setStreamingContent(null);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let finalTurnIndex = 0;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(raw);
            } catch {
              continue;
            }

            if (typeof parsed.token === "string") {
              accumulated += parsed.token;
              setStreamingContent(accumulated);
            } else if (parsed.done === true) {
              finalTurnIndex = (parsed.turnIndex as number) ?? 0;
            } else if (parsed.sessionExpired) {
              setError("expired");
              setStreamingContent(null);
              return;
            } else if (parsed.error) {
              setError("network");
              setStreamingContent(null);
              return;
            }
          }
        }

        const userMsg: Message = {
          id: `user-${now}`,
          role: "user",
          content: message,
          timestamp: now,
        };
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: accumulated,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMsg, botMsg]);
        setTurnCount(finalTurnIndex + 1);
      } catch {
        setError("network");
      } finally {
        setStreamingContent(null);
      }
    });
  }

  async function handleClearExpired() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.assign("/");
  }

  return (
    <ChatContext.Provider
      value={{
        sessionId,
        optimisticMessages,
        streamingContent,
        error,
        turnCount,
        input,
        isPending,
        setInput,
        clearError,
        sendMessage,
        handleClearExpired,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
