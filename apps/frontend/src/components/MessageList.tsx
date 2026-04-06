"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/context/ChatContext";
import { MessageBubble } from "./MessageBubble";
import { StreamingBubble } from "./StreamingBubble";

export function MessageList() {
  const { optimisticMessages, streamingContent } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimisticMessages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {optimisticMessages.length === 0 && streamingContent === null && (
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

        {optimisticMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <StreamingBubble />

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
