import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Stethoscope,
  Plus,
  Activity,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "MediMind AI — Virtual Health Assistant" },
      {
        name: "description",
        content:
          "Describe your symptoms and get instant, AI-powered insights about possible conditions, urgency, and next steps.",
      },
    ],
  }),
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  {
    icon: Activity,
    title: "Persistent headache",
    prompt:
      "I've had a throbbing headache on the right side of my head for 3 days, with mild nausea. What could it be?",
  },
  {
    icon: Sparkles,
    title: "Skin rash",
    prompt:
      "I have an itchy red rash on my forearms that started after gardening yesterday. What could be causing it?",
  },
  {
    icon: ShieldCheck,
    title: "Sore throat & fever",
    prompt:
      "I've had a sore throat, fever of 38.5°C and body aches for 2 days. Should I be worried?",
  },
  {
    icon: AlertTriangle,
    title: "Stomach pain",
    prompt:
      "Sharp pain in my lower right abdomen for 6 hours, getting worse. What could this mean?",
  },
];

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || "Failed to reach the assistant.");
      }

      let acc = "";
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      // push placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as
              | string
              | undefined;
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: acc,
                };
                return copy;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setMessages((prev) =>
        prev[prev.length - 1]?.role === "assistant" &&
        prev[prev.length - 1].content === ""
          ? prev.slice(0, -1)
          : prev,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                MediMind AI
              </div>
              <div className="text-[11px] text-muted-foreground">
                Virtual Health Assistant
              </div>
            </div>
          </div>
        </div>

        <div className="p-3">
          <button
            onClick={reset}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4" />
            New consultation
          </button>
        </div>

        <div className="px-4 pt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Today
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="rounded-lg px-3 py-2 text-sm bg-accent/60 text-accent-foreground truncate">
            {messages.find((m) => m.role === "user")?.content.slice(0, 40) ||
              "New consultation"}
          </div>
        </nav>

        <div className="p-3 border-t border-border">
          <div className="rounded-lg bg-muted/70 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Privacy first
            </div>
            Your conversations are processed securely. This tool is for
            informational purposes only and is not a medical diagnosis.
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 md:px-6 py-3">
          <div className="flex items-center gap-2">
            <div
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">MediMind AI</h1>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                Online · Symptom analysis
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="md:hidden text-xs font-medium text-primary"
          >
            New
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <Welcome onPick={(p) => send(p)} />
          ) : (
            <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-6">
              {messages.map((m, i) => (
                <Message key={i} msg={m} />
              ))}
              {isLoading &&
                messages[messages.length - 1]?.role === "user" && (
                  <Message msg={{ role: "assistant", content: "" }} typing />
                )}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
            <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          </div>
        )}

        <div className="border-t border-border bg-background/90 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 md:px-6 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="relative flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-soft)] focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 transition"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Describe your symptoms in detail…"
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground transition disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
                style={{ background: "var(--gradient-primary)" }}
                aria-label="Send"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              MediMind AI provides informational guidance only — always consult
              a licensed healthcare professional.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Welcome({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-12 md:py-20">
      <div className="text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-primary-foreground shadow-[var(--shadow-elegant)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Stethoscope className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight">
          How are you feeling today?
        </h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Describe your symptoms and I'll help you understand possible
          conditions, urgency, and the right next steps.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => onPick(s.prompt)}
            className="group text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-[var(--shadow-soft)] transition"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <s.icon className="h-4 w-4 text-primary" />
              {s.title}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 group-hover:text-foreground/80 transition">
              {s.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ msg, typing = false }: { msg: Msg; typing?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow-sm"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Stethoscope className="h-4 w-4" />
        </div>
      )}
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed shadow-sm"
            : "max-w-[90%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 text-sm leading-relaxed shadow-[var(--shadow-soft)]"
        }
      >
        {typing ? (
          <div className="flex items-center gap-1.5 py-1">
            <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" />
          </div>
        ) : isUser ? (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-p:my-2 prose-strong:text-foreground prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold">
          You
        </div>
      )}
    </div>
  );
}
