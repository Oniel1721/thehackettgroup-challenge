"use client";

import { useChat } from "@/context/ChatContext";

export function ErrorBanner() {
  const { error, handleClearExpired } = useChat();

  if (error === "expired") {
    return (
      <div className="flex shrink-0 items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
        <span>Your session has expired.</span>
        <button
          onClick={handleClearExpired}
          className="ml-4 rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200"
        >
          Start new session
        </button>
      </div>
    );
  }

  if (error === "network") {
    return (
      <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
        Connection lost, please retry.
      </div>
    );
  }

  if (error === "ratelimit") {
    return (
      <div className="shrink-0 border-b border-orange-200 bg-orange-50 px-6 py-3 text-sm text-orange-800">
        Too many messages. You&apos;ve reached the limit of 20 messages per
        hour. Please try again later.
      </div>
    );
  }

  return null;
}
