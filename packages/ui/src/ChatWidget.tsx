"use client";

import type { ChatMessage, ChatReply } from "@repo/ai-client";
import { useState } from "react";
import { Button } from "./Button";

export interface ChatWidgetProps {
  endpoint?: string;
  title?: string;
}

export function ChatWidget({ endpoint = "/api/assistant", title = "Shopping assistant" }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!response.ok) throw new Error(`assistant error ${response.status}`);
      const reply = (await response.json()) as ChatReply;
      setMessages([...next, reply.message]);
    } catch (error) {
      setMessages([
        ...next,
        { role: "assistant", content: `Assistant unavailable: ${(error as Error).message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex h-full min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
        {title}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ask for a gift idea, compare products, or get help choosing a variant.
          </p>
        ) : (
          messages.map((message, index) => (
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
          ))
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
        <Button type="submit" disabled={busy}>
          {busy ? "..." : "Send"}
        </Button>
      </form>
    </section>
  );
}
