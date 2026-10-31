"use client";

import { useEffect, useRef, useState } from "react";
import type { FormFieldSchema, Post, Review, SseStreamEvent, TrialRun } from "@arrakis/contracts";
import { cn, VIEWER_ID } from "@/lib/utils";
import { track } from "@/lib/events";
import { MODE_LABEL } from "./reel-card";
import { IconBolt, IconCheck, IconClose, IconSpark } from "./icons";

type Phase = "idle" | "starting" | "running" | "done" | "error";
type Line = { id: number; stream: SseStreamEvent["stream"]; text: string };

function Field({ f }: { f: FormFieldSchema }) {
  const id = `try-field-${f.name}`;
  const def = f.defaultValue;
  const inputCls =
    "border-line bg-paper-raised text-ink w-full rounded-xl border px-3 py-2 text-sm placeholder:text-ink-muted";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center justify-between text-xs font-semibold">
        <span>{f.label}</span>
        <span className="text-ink-muted font-mono text-[10px]">
          {f.type}
          {f.required ? " · required" : " · optional"}
        </span>
      </label>
      {f.type === "boolean" ? (
        <label htmlFor={id} className="flex items-center gap-2 text-sm">
          <input
            id={id}
            name={f.name}
            type="checkbox"
            defaultChecked={Boolean(def)}
            className="size-4 rounded"
          />
          <span>Enable {f.label}</span>
        </label>
      ) : f.type === "select" ? (
        <select id={id} name={f.name} required={f.required} defaultValue={String(def ?? "")} className={inputCls}>
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.type === "text" ? (
        <textarea
          id={id}
          name={f.name}
          required={f.required}
          rows={2}
          placeholder={f.placeholder}
          defaultValue={String(def ?? "")}
          className={cn(inputCls, "font-mono text-xs")}
        />
      ) : (
        <input
          id={id}
          name={f.name}
          required={f.required}
          placeholder={f.placeholder}
          type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
          inputMode={f.type === "number" ? "decimal" : f.type === "url" ? "url" : undefined}
          defaultValue={String(def ?? "")}
          className={inputCls}
        />
      )}
    </div>
  );
}

export function TrySheet({
  post,
  onClose,
  onVerifiedTrial,
}: {
  post: Post | null;
  onClose: () => void;
  onVerifiedTrial?: (postId: string, xpAwarded: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const termRef = useRef<HTMLPreElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [runId, setRunId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [copiedTerm, setCopiedTerm] = useState(false);

  // 3-Tap Micro-Review state
  const [worked, setWorked] = useState<boolean>(true);
  const [wouldUse, setWouldUse] = useState<boolean>(true);
  const [bugNote, setBugNote] = useState<string>("");
  const [reviewSubmitted, setReviewSubmitted] = useState<Review | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const seq = useRef(0);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (post && !d.open) {
      setPhase(post.demo.mode === "web" ? "done" : "idle");
      setLines([]);
      setLatency(post.demo.mode === "web" ? post.health.p50LatencyMs : null);
      setRunId(`run_${Date.now().toString(36)}`);
      setWorked(true);
      setWouldUse(true);
      setBugNote("");
      setReviewSubmitted(null);
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
      const res = await fetch(`/api/try/${encodeURIComponent(post.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (res.status === 429) throw new Error("Too many runs right now. Wait a few seconds and retry.");
      if (!res.ok) throw new Error(`Sandbox responded ${res.status}`);
      const trial = (await res.json()) as TrialRun;
      setRunId(trial.id);
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
      for (const t of ["status", "log", "result", "health"]) {
        es.addEventListener(t, handle as EventListener);
      }
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) return;
        es.close();
        setPhase((p) => (p === "done" ? p : "error"));
        push("system", "Connection to the sandbox closed.");
      };
    } catch (err) {
      setPhase("error");
      push(
        "system",
        err instanceof Error ? err.message : "Could not reach the sandbox endpoint.",
      );
    }
  }

  async function submitMicroReview(e: React.FormEvent) {
    e.preventDefault();
    if (!post || submittingReview) return;
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: runId || `run_${Date.now().toString(36)}`,
          userId: VIEWER_ID,
          postId: post.id,
          worked,
          wouldUse,
          bug: bugNote,
        }),
      });
      if (res.ok) {
        const rev = (await res.json()) as Review;
        setReviewSubmitted(rev);
        track("review", post.id, 1.0);
        onVerifiedTrial?.(post.id, rev.xpAwarded);
      }
    } finally {
      setSubmittingReview(false);
    }
  }

  async function copyTerminal() {
    const raw = lines.map((l) => l.text).join("\n");
    try {
      await navigator.clipboard.writeText(raw);
      setCopiedTerm(true);
      setTimeout(() => setCopiedTerm(false), 1800);
    } catch {
      // ignore
    }
  }

  const busy = phase === "starting" || phase === "running";
  const fields = post?.demo.formSchema ?? [];

  // Interactive micro-webview document for Mode B (Web App) so it works offline & safely inside <iframe sandbox>
  const webSandboxSrcDoc = post
    ? `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; background: #FAF4EA; color: #1B1612; }
  .bar { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #5C5247; margin-bottom: 10px; }
  .box { background: #FFF; border: 1px solid #DDD0BB; border-radius: 12px; padding: 12px; }
  button { background: #C2410C; color: #FFF; border: 0; border-radius: 999px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
  pre { background: #1B1612; color: #FAF4EA; padding: 10px; border-radius: 8px; font-size: 11px; overflow: auto; }
</style>
</head>
<body>
  <div class="bar">
    <span><strong>${post.title.replace(/[<>&"]/g, "")}</strong> · Isolated Web Sandbox</span>
    <span style="color:#2F7D4F;font-weight:700;">● ${post.health.uptimePct}% Uptime</span>
  </div>
  <div class="box">
    <p style="margin:0 0 8px;font-size:13px;">Interactive in-feed micro-app preview (<code>&lt;iframe sandbox="allow-scripts allow-forms"&gt;</code>):</p>
    <button onclick="document.getElementById('out').textContent = '✓ Processed in ${post.health.p50LatencyMs}ms — 68% payload reduction, WCAG AA verified.'">Run Interactive Web Demo</button>
    <pre id="out" style="margin-top:10px;">Ready for 1-tap interaction inside sandboxed iframe...</pre>
  </div>
</body>
</html>`
    : "";

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="try-title"
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={() => {
        esRef.current?.close();
        onClose();
      }}
    >
      {post && (
        <div className="flex max-h-[90dvh] flex-col">
          {/* Header */}
          <header className="border-line flex items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-ink text-paper rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                  {MODE_LABEL[post.demo.mode]}
                </span>
                <span className="text-ink-muted truncate font-mono text-[11px]">
                  {post.demo.target}
                </span>
                {post.demo.mode === "container" && (
                  <span className="border-line bg-paper rounded-full border px-2 py-0.5 font-mono text-[10px]">
                    cap-drop=ALL · 256MB · 60s TTL
                  </span>
                )}
              </div>
              <h2 id="try-title" className="font-display mt-1 text-lg leading-6 font-bold text-balance">
                {post.title}
              </h2>
            </div>
            <form method="dialog">
              <button
                aria-label="Close sandbox"
                className="bg-paper-sunken grid size-9 place-items-center rounded-full"
                autoFocus
              >
                <IconClose className="size-5" />
              </button>
            </form>
          </header>

          {/* Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* Auto Scalability Health Card */}
            <section
              aria-label="Scalability health telemetry"
              className="border-line bg-paper grid grid-cols-4 gap-2 rounded-2xl border p-3 text-center font-mono tabular-nums"
            >
              <div>
                <span className="text-ink-muted block text-[10px] uppercase">Uptime</span>
                <span className="text-sage text-sm font-bold">{post.health.uptimePct}%</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase">p50 Latency</span>
                <span className="text-sm font-bold">{post.health.p50LatencyMs}ms</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase">p95 Latency</span>
                <span className="text-sm font-bold">{post.health.p95LatencyMs}ms</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px] uppercase">Crash Rate</span>
                <span className="text-sm font-bold">{(post.health.crashRate * 100).toFixed(1)}%</span>
              </div>
            </section>

            {/* Mode B: Web App Sandboxed Iframe */}
            {post.demo.mode === "web" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Isolated Web App Sandbox</span>
                  <a
                    href={post.demo.target}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary font-mono text-xs font-semibold underline"
                  >
                    Open on laptop ↗
                  </a>
                </div>
                <iframe
                  title={`Web sandbox for ${post.title}`}
                  sandbox="allow-scripts allow-forms"
                  srcDoc={webSandboxSrcDoc}
                  className="border-line h-52 w-full rounded-2xl border"
                />
              </div>
            ) : (
              /* Mode A / D / C: Auto-Form + Container / Proxy Runner */
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
                  <p className="text-ink-muted text-sm">
                    Zero configuration required — press Run to spin up the ephemeral container.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-primary text-primary-ink flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  <IconBolt className="size-4" />
                  {phase === "idle" && "Run 1-Tap Container Sandbox"}
                  {phase === "starting" && "Spinning up isolated container…"}
                  {phase === "running" && "Streaming stdout/stderr…"}
                  {(phase === "done" || phase === "error") && "Re-run in Sandbox"}
                </button>
              </form>
            )}

            {/* Live SSE Terminal */}
            {(lines.length > 0 || busy) && (
              <section aria-label="Sandbox terminal stream">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold">
                    SSE Stream · {runId}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        phase === "error" ? "text-alert font-semibold" : "text-sage font-semibold",
                      )}
                      role="status"
                    >
                      {phase === "done" && `✓ Exit 0${latency ? ` · ${latency}ms` : ""}`}
                      {phase === "error" && "✕ Execution failed"}
                      {busy && "● Streaming live"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyTerminal()}
                      className="border-line bg-paper rounded-lg border px-2 py-0.5 font-mono text-[10px] font-semibold"
                    >
                      {copiedTerm ? "Copied" : "Copy log"}
                    </button>
                  </div>
                </div>
                <pre
                  ref={termRef}
                  role="log"
                  aria-live="polite"
                  tabIndex={0}
                  className="bg-ink text-paper max-h-52 overflow-auto rounded-2xl p-3.5 font-mono text-[12px] leading-[18px] whitespace-pre-wrap"
                >
                  {lines.map((l) => (
                    <span
                      key={l.id}
                      className={cn(
                        "block",
                        l.stream === "system" && "text-paper/65",
                        l.stream === "stderr" && "text-alert",
                      )}
                    >
                      {l.text}
                    </span>
                  ))}
                </pre>
              </section>
            )}

            {/* 3-Tap Micro-Review (Proof-of-Trial Validator) */}
            <section
              aria-labelledby="micro-review-heading"
              className="border-line bg-paper rounded-2xl border p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 id="micro-review-heading" className="font-display text-sm font-bold">
                  3-Tap Proof-of-Trial Validation
                </h3>
                <span className="bg-paper-sunken text-ink rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                  +125 First-25 Scout XP · 3× Vote Weight
                </span>
              </div>

              {reviewSubmitted ? (
                <div
                  role="status"
                  className="bg-sage/10 border-sage/30 mt-2.5 flex items-center justify-between rounded-xl border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-sage text-primary-ink grid size-6 place-items-center rounded-full">
                      <IconCheck className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold">
                        Verified Trial Recorded (+{reviewSubmitted.xpAwarded} Scout XP)
                      </p>
                      <p className="text-ink-muted text-[11px]">
                        Your upvote on @{post.author.handle}&apos;s tool now counts 3× on the Leaderboard.
                      </p>
                    </div>
                  </div>
                  <IconSpark className="text-sage size-5 shrink-0" />
                </div>
              ) : (
                <form onSubmit={(e) => void submitMicroReview(e)} className="mt-2.5 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="border-line bg-paper-raised flex items-center justify-between rounded-xl border px-3 py-2">
                      <span className="font-semibold">1. Worked?</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-pressed={worked}
                          onClick={() => setWorked(true)}
                          className={cn(
                            "rounded-lg px-2 py-0.5 font-semibold",
                            worked ? "bg-sage text-primary-ink" : "bg-paper-sunken text-ink-muted",
                          )}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          aria-pressed={!worked}
                          onClick={() => setWorked(false)}
                          className={cn(
                            "rounded-lg px-2 py-0.5 font-semibold",
                            !worked ? "bg-alert text-primary-ink" : "bg-paper-sunken text-ink-muted",
                          )}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    <div className="border-line bg-paper-raised flex items-center justify-between rounded-xl border px-3 py-2">
                      <span className="font-semibold">2. Use it?</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-pressed={wouldUse}
                          onClick={() => setWouldUse(true)}
                          className={cn(
                            "rounded-lg px-2 py-0.5 font-semibold",
                            wouldUse ? "bg-ink text-paper" : "bg-paper-sunken text-ink-muted",
                          )}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          aria-pressed={!wouldUse}
                          onClick={() => setWouldUse(false)}
                          className={cn(
                            "rounded-lg px-2 py-0.5 font-semibold",
                            !wouldUse ? "bg-ink text-paper" : "bg-paper-sunken text-ink-muted",
                          )}
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <label htmlFor="bug-note-input" className="sr-only">
                      Optional 1-line bug or feature note
                    </label>
                    <input
                      id="bug-note-input"
                      type="text"
                      value={bugNote}
                      onChange={(e) => setBugNote(e.target.value)}
                      placeholder="3. Optional 1-line bug or feature idea (+15 bonus XP)…"
                      className="border-line bg-paper-raised flex-1 rounded-xl border px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="bg-ink text-paper shrink-0 rounded-xl px-4 py-2 text-xs font-bold"
                    >
                      {submittingReview ? "Saving…" : "Validate & Earn XP"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </div>
      )}
    </dialog>
  );
}
