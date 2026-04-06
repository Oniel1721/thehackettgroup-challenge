"use client";

import { useChat } from "@/context/ChatContext";
import { MarkdownContent } from "./MarkdownContent";

export function StreamingBubble() {
  const { streamingContent } = useChat();

  if (streamingContent === null) return null;

  return (
    <div className="flex items-end gap-2 flex-row">
      <span className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
        AI
      </span>
      <div className="flex max-w-[75%] flex-col gap-1 items-start">
        <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200">
          {streamingContent ? (
            <>
              <MarkdownContent content={streamingContent} />
              <span className="cursor-blink" />
            </>
          ) : (
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
