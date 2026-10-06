"use client";

import type { ChatMessage, ChatReply } from "@repo/ai-client";
import { useState } from "react";
import { Button } from "./Button";

export interface ChatWidgetProps {
  endpoint?: string;
  title?: string;
}

const SUGGESTIONS = ["gift under $200", "compare headphones", "recommend a brand"];

interface SuggestionChipProps {
  label: string;
  onClick: () => void;
}

export function SuggestionChip({ label, onClick }: SuggestionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 hover:border-slate-300 transition-colors"
    >
      {label}
    </button>
  );
}

export function TypingIndicator() {
  return (
    <div className="mr-auto max-w-[85%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-800 flex items-center gap-1.5" aria-label="Assistant is typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></span>
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></span>
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></span>
    </div>
  );
}

export function ChatWidget({ endpoint = "/api/assistant", title = "Shopping assistant" }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function send(customText?: string) {
    const content = customText !== undefined ? customText.trim() : input.trim();
    if (!content || status === "loading") return;

    if (customText === undefined) {
      setInput("");
    }

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setStatus("loading");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!response.ok) throw new Error(`assistant error ${response.status}`);
      const reply = (await response.json()) as ChatReply;
      setMessages([...next, reply.message]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
    }
  }

  async function retry() {
    if (messages.length === 0) return;
    setStatus("loading");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (!response.ok) throw new Error(`assistant error ${response.status}`);
      const reply = (await response.json()) as ChatReply;
      setMessages([...messages, reply.message]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
    }
  }

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
        {title}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Ask for a gift idea, compare products, or get help choosing a variant.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <SuggestionChip
                  key={suggestion}
                  label={suggestion}
                  onClick={() => void send(suggestion)}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white"
                    : "mr-auto max-w-[85%] rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-800"
                }
              >
                {message.content}
              </div>
            ))}
            {status === "loading" && <TypingIndicator />}
            {status === "error" && ( 
              <div className="mr-auto max-w-[85%] rounded-2xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700 space-y-1">
                <p>Assistant unavailable. Please try again.</p>
                <div className="flex gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => void retry()}
                    className="text-red-800 underline hover:text-red-900"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <form
        className="flex gap-2 border-t border-slate-100 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the assistant..."
        />
        <Button type="submit" disabled={status === "loading"}>
          Send
        </Button>
      </form>
    </section>
  );
}
