"use client";

import { useEffect, useRef, useState } from "react";
import type { FormFieldSchema, Post, SseStreamEvent, TrialRun } from "@arrakis/contracts";
import { cn } from "@/lib/utils";
import { track } from "@/lib/events";
import { MODE_LABEL } from "./reel-card";
import { IconBolt, IconClose } from "./icons";

const SANDBOX_URL = process.env.NEXT_PUBLIC_SANDBOX_URL ?? "http://localhost:4002";

type Phase = "idle" | "starting" | "running" | "done" | "error";
type Line = { id: number; stream: SseStreamEvent["stream"]; text: string };

function Field({ f }: { f: FormFieldSchema }) {
  const common = {
    id: `f-${f.name}`,
    name: f.name,
    required: f.required,
    placeholder: f.placeholder,
    className:
      "border-line bg-paper-raised text-ink w-full rounded-xl border px-3 py-2 text-sm placeholder:text-ink-muted",
  };
  const def = f.defaultValue;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={common.id} className="text-sm font-medium">
        {f.label}
        {!f.required && <span className="text-ink-muted font-normal"> (optional)</span>}
      </label>
      {f.type === "boolean" ? (
        <input type="checkbox" {...common} defaultChecked={Boolean(def)} className="size-5" />
      ) : f.type === "select" ? (
        <select {...common} defaultValue={String(def ?? "")}>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : f.type === "text" ? (
        <textarea {...common} rows={3} defaultValue={String(def ?? "")} />
      ) : (
        <input
          {...common}
          type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
          inputMode={f.type === "number" ? "decimal" : f.type === "url" ? "url" : undefined}
          defaultValue={String(def ?? "")}
        />
      )}
    </div>
  );
}

export function TrySheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const termRef = useRef<HTMLPreElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const seq = useRef(0);

  // Open as a native modal when a post is selected; the browser handles focus, inert page and Esc.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (post && !d.open) {
      setPhase("idle");
      setLines([]);
      setLatency(null);
      d.showModal();
    }
    if (!post && d.open) d.close();
  }, [post]);

  // Light-dismiss fallback where <dialog closedby> is unsupported.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d || "closedBy" in HTMLDialogElement.prototype) return;
    let pressedOutside = false;
    const outside = (e: PointerEvent) => {
      const r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const down = (e: PointerEvent) => (pressedOutside = outside(e));
    const up = (e: PointerEvent) => {
      if (pressedOutside && outside(e)) d.close();
    };
    d.addEventListener("pointerdown", down);
    d.addEventListener("pointerup", up);
    return () => {
      d.removeEventListener("pointerdown", down);
      d.removeEventListener("pointerup", up);
    };
  }, []);

  useEffect(() => () => esRef.current?.close(), []);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight });
  }, [lines]);

  const push = (stream: SseStreamEvent["stream"], text: string) =>
    setLines((l) => [...l.slice(-400), { id: seq.current++, stream, text }]);

  async function run(form: HTMLFormElement) {
    if (!post) return;
    esRef.current?.close();
    setLines([]);
    setLatency(null);
    setPhase("starting");
    track("try", post.id, 0.6);
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch(`${SANDBOX_URL}/try/${encodeURIComponent(post.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (res.status === 429) throw new Error("Too many runs right now. Wait a few seconds and retry.");
      if (!res.ok) throw new Error(`Sandbox responded ${res.status}`);
      const trial = (await res.json()) as TrialRun;
      const es = new EventSource(trial.streamUrl);
      esRef.current = es;
      const handle = (e: MessageEvent<string>) => {
        const evt = JSON.parse(e.data) as SseStreamEvent;
        if (evt.line) push(evt.stream ?? "system", evt.line);
        if (evt.type === "status" && evt.status === "running") setPhase("running");
        if (evt.type === "result") {
          setLatency(post.health.p50LatencyMs);
          if (evt.output) push("stdout", JSON.stringify(evt.output, null, 2));
        }
        if (evt.type === "health") {
          setPhase("done");
          es.close();
        }
      };
      for (const t of ["status", "log", "result", "health"]) es.addEventListener(t, handle as EventListener);
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) return;
        es.close();
        setPhase((p) => (p === "done" ? p : "error"));
        push("system", "Connection to the sandbox was lost.");
      };
    } catch (err) {
      setPhase("error");
      push(
        "system",
        err instanceof Error && err.message.startsWith("Too many")
          ? err.message
          : "Could not reach the sandbox service. Start it with `npm run dev:sandbox` and retry.",
      );
    }
  }

  const busy = phase === "starting" || phase === "running";
  const fields = post?.demo.formSchema ?? [];

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="try-title"
      // closedby is not in React's DOM typings yet; it is progressive enhancement.
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={() => {
        esRef.current?.close();
        onClose();
      }}
    >
      {post && (
        <div className="flex max-h-[88dvh] flex-col">
          <header className="border-line flex items-start gap-3 border-b p-4">
            <div className="min-w-0 flex-1">
              <p className="text-ink-muted text-xs font-medium">{MODE_LABEL[post.demo.mode]}</p>
              <h2 id="try-title" className="font-display text-lg leading-6 font-bold text-balance">
                {post.title}
              </h2>
            </div>
            <form method="dialog">
              <button
                aria-label="Close"
                className="bg-paper-sunken grid size-9 place-items-center rounded-full"
                autoFocus
              >
                <IconClose className="size-5" />
              </button>
            </form>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <p className="text-ink-muted text-sm text-pretty">{post.problemStatement}</p>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(e.currentTarget);
              }}
            >
              {fields.map((f) => (
                <Field key={f.name} f={f} />
              ))}
              {fields.length === 0 && (
                <p className="text-ink-muted text-sm">This demo needs no input. Press run to start it.</p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="bg-primary text-primary-ink flex h-11 w-full items-center justify-center gap-2 rounded-full font-bold disabled:opacity-60"
              >
                <IconBolt className="size-5" />
                {phase === "idle" && "Run in sandbox"}
                {phase === "starting" && "Starting container…"}
                {phase === "running" && "Running…"}
                {(phase === "done" || phase === "error") && "Run again"}
              </button>
            </form>

            {(lines.length > 0 || busy) && (
              <section aria-label="Sandbox output">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">Live output</span>
                  <span
                    className={cn("tabular-nums", phase === "error" ? "text-alert" : "text-ink-muted")}
                    role="status"
                  >
                    {phase === "done" && `Finished${latency ? ` in ${latency}ms` : ""}`}
                    {phase === "error" && "Failed"}
                    {busy && "Streaming"}
                  </span>
                </div>
                <pre
                  ref={termRef}
                  role="log"
                  aria-live="polite"
                  tabIndex={0}
                  className="bg-ink text-paper max-h-56 overflow-auto rounded-xl p-3 font-mono text-[12px] leading-[18px] whitespace-pre-wrap"
                >
                  {lines.map((l) => (
                    <span
                      key={l.id}
                      className={cn("block", l.stream === "system" && "text-paper/60", l.stream === "stderr" && "text-alert")}
                    >
                      {l.text}
                    </span>
                  ))}
                </pre>
              </section>
            )}
            {phase === "error" && (
              <p className="text-alert text-sm" role="alert">
                The run did not finish. Check your input, then run again.
              </p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
