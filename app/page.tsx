
"use client";

import { useState, type FormEvent } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedQuestion = question.trim();

    if (!submittedQuestion || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", text: submittedQuestion },
    ]);
    setQuestion("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: submittedQuestion,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          [data.error, data.details].filter(Boolean).join(" — ") ||
            `Request failed with status ${response.status}.`
        );
      }

      if (typeof data.answer !== "string") {
        throw new Error("The server did not return an answer.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: data.answer,
          sources: Array.isArray(data.sources)
            ? data.sources
            : [],
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the chat API."
      );
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "Which technologies does this project use?",
    "How does document retrieval work?",
    "What is the purpose of this project?",
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            RAG · Gemini · Knowledge Search
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Knowledge Assistant
          </h1>

          <p className="mt-3 text-slate-400">
            Ask questions and get answers grounded in your documents.
          </p>
        </header>

        <section
          aria-label="Conversation"
          aria-live="polite"
          className="flex-1 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6"
        >
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 p-6">
              <p className="font-medium text-white">
                Try asking:
              </p>

              <div className="mt-3 space-y-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="block text-left text-cyan-300 hover:underline"
                    onClick={() => setQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`rounded-xl p-4 ${
                message.role === "user"
                  ? "ml-4 bg-cyan-950/70 sm:ml-12"
                  : "mr-4 bg-slate-800 sm:mr-12"
              }`}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {message.role === "user"
                  ? "You"
                  : "Knowledge Assistant"}
              </p>

              <p className="whitespace-pre-wrap leading-7">
                {message.text}
              </p>

              {!!message.sources?.length && (
                <div className="mt-4 border-t border-slate-700 pt-3">
                  <p className="text-xs font-semibold text-cyan-300">
                    Retrieved sources
                  </p>

                  <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
                    {message.sources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}

          {loading && (
            <p role="status" className="animate-pulse text-cyan-300">
              Searching documents and generating your answer...
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-200"
            >
              <p className="font-semibold">Request failed</p>
              <p className="mt-1 break-words text-sm">{error}</p>
            </div>
          )}
        </section>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={1000}
            placeholder="Ask about your documents..."
            aria-label="Your question"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
          />

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Thinking..." : "Ask"}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-slate-500">
          Answers are generated from retrieved documents and may need verification.
        </p>
      </div>
    </main>
  );
}
