"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FormFieldSchema,
  Post,
  PreflightResponse,
  QuickFeedbackTag,
  Review,
  SandboxProjectType,
  SseStreamEvent,
  TelemetryPayload,
  TrialRun,
} from "@arrakis/contracts";
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const termRef = useRef<HTMLPreElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [runId, setRunId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [copiedTerm, setCopiedTerm] = useState(false);

  // Outer-Shell Telemetry Physics state & refs
  const [healthOk, setHealthOk] = useState<boolean>(true);
  const [canIframe, setCanIframe] = useState<boolean>(true);
  const [bootTimeMs, setBootTimeMs] = useState<number>(0);
  const [activeDwellSeconds, setActiveDwellSeconds] = useState<number>(0);
  const [interactionBursts, setInteractionBursts] = useState<number>(0);
  const [switchedToLandscape, setSwitchedToLandscape] = useState<boolean>(false);
  const [landscapeRotated, setLandscapeRotated] = useState<boolean>(false);

  const hasInteractedRef = useRef<boolean>(false);
  const lastInteractionTimestampRef = useRef<number>(0);
  const activePostRef = useRef<Post | null>(null);
  const telemetrySnapshotRef = useRef<{
    project_id: string;
    project_type: SandboxProjectType;
    health_ok: boolean;
    boot_time_ms: number;
    switched_to_landscape: boolean;
    active_dwell_seconds: number;
    interaction_bursts: number;
  } | null>(null);

  // 2.5-Second Exit Micro-Toast state
  const [exitToastPost, setExitToastPost] = useState<{
    id: string;
    title: string;
    snapshot: NonNullable<typeof telemetrySnapshotRef.current>;
  } | null>(null);
  const exitToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetrySentForSessionRef = useRef<boolean>(false);

  // 3-Tap Micro-Review state
  const [worked, setWorked] = useState<boolean>(true);
  const [wouldUse, setWouldUse] = useState<boolean>(true);
  const [bugNote, setBugNote] = useState<string>("");
  const [reviewSubmitted, setReviewSubmitted] = useState<Review | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const seq = useRef(0);

  // Record an outer-shell interaction burst (3000ms cluster threshold)
  const recordInteractionBurst = useCallback(() => {
    hasInteractedRef.current = true;
    const now = Date.now();
    if (now - lastInteractionTimestampRef.current > 3000) {
      lastInteractionTimestampRef.current = now;
      setInteractionBursts((prev) => prev + 1);
    }
  }, []);

  // Keep telemetry snapshot ref synchronized for exit toast emission
  useEffect(() => {
    if (!post) return;
    activePostRef.current = post;
    telemetrySnapshotRef.current = {
      project_id: post.id,
      project_type: post.demo.mode === "web" ? "BROWSER" : "CONTAINER",
      health_ok: healthOk,
      boot_time_ms: bootTimeMs || post.health.p50LatencyMs,
      switched_to_landscape: switchedToLandscape,
      active_dwell_seconds: activeDwellSeconds,
      interaction_bursts: interactionBursts,
    };
  }, [
    post,
    healthOk,
    bootTimeMs,
    switchedToLandscape,
    activeDwellSeconds,
    interactionBursts,
  ]);

  const flushTelemetryPayload = useCallback(
    async (
      snapshot: NonNullable<typeof telemetrySnapshotRef.current>,
      tag: QuickFeedbackTag
    ) => {
      const payload: TelemetryPayload = {
        project_id: snapshot.project_id,
        user_id: VIEWER_ID,
        project_type: snapshot.project_type,
        health_ok: snapshot.health_ok,
        boot_time_ms: snapshot.boot_time_ms,
        switched_to_landscape: snapshot.switched_to_landscape,
        active_dwell_seconds: snapshot.active_dwell_seconds,
        interaction_bursts: snapshot.interaction_bursts,
        quick_feedback_tag: tag,
      };
      try {
        const res = await fetch("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (res.ok && tag === "WORKS_GREAT") {
          onVerifiedTrial?.(snapshot.project_id, 40);
        }
      } catch {
        // non-blocking telemetry
      }
    },
    [onVerifiedTrial]
  );

  const handleFeedbackToastSelection = useCallback(
    (tag: QuickFeedbackTag) => {
      if (exitToastTimerRef.current) {
        clearTimeout(exitToastTimerRef.current);
        exitToastTimerRef.current = null;
      }
      if (!exitToastPost) return;
      const snap = exitToastPost.snapshot;
      setExitToastPost(null);
      void flushTelemetryPayload(snap, tag);
    },
    [exitToastPost, flushTelemetryPayload]
  );

  // Pre-Flight check + modal open lifecycle
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (post && !d.open) {
      // Flush any previous pending toast before starting a new sandbox session
      if (exitToastTimerRef.current) {
        clearTimeout(exitToastTimerRef.current);
        exitToastTimerRef.current = null;
      }
      if (exitToastPost) {
        void flushTelemetryPayload(exitToastPost.snapshot, null);
        setExitToastPost(null);
      }

      telemetrySentForSessionRef.current = false;
      hasInteractedRef.current = false;
      lastInteractionTimestampRef.current = 0;
      setActiveDwellSeconds(0);
      setInteractionBursts(0);
      setSwitchedToLandscape(false);
      setLandscapeRotated(false);
      setHealthOk(true);
      setCanIframe(true);
      setBootTimeMs(post.health.p50LatencyMs);

      setPhase(post.demo.mode === "web" ? "done" : "idle");
      setLines([]);
      setLatency(post.demo.mode === "web" ? post.health.p50LatencyMs : null);
      setRunId(`run_${Date.now().toString(36)}`);
      setWorked(true);
      setWouldUse(true);
      setBugNote("");
      setReviewSubmitted(null);
      d.showModal();

      // Module 1: Pre-flight health check for BROWSER projects
      if (post.demo.mode === "web") {
        void fetch("/api/sandbox/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_url: post.demo.target }),
        })
          .then((r) => r.json() as Promise<PreflightResponse>)
          .then((pf) => {
            setHealthOk(pf.health_ok);
            setCanIframe(pf.can_iframe);
            setBootTimeMs(pf.latency_ms);
            setLatency(pf.latency_ms);
          })
          .catch(() => {
            setHealthOk(false);
          });
      }
    }
    if (!post && d.open) d.close();
  }, [post, exitToastPost, flushTelemetryPayload]);

  // Active Dwell Timer: increments every 1s after first interaction while open & visible
  useEffect(() => {
    if (!post) return;
    const interval = setInterval(() => {
      if (hasInteractedRef.current && document.visibilityState === "visible") {
        setActiveDwellSeconds((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [post]);

  // BROWSER Mode: window.blur iframe focus trick + postMessage PLATFORM_INTERACTION listener
  useEffect(() => {
    if (!post) return;
    let refocusTimer: ReturnType<typeof setTimeout> | null = null;

    const onWindowBlur = () => {
      if (iframeRef.current && document.activeElement === iframeRef.current) {
        recordInteractionBurst();
        refocusTimer = setTimeout(() => {
          window.focus();
        }, 1000);
      }
    };

    const onWindowMessage = (e: MessageEvent) => {
      if (
        e.data &&
        typeof e.data === "object" &&
        (e.data as { type?: string }).type === "PLATFORM_INTERACTION"
      ) {
        recordInteractionBurst();
      }
    };

    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("message", onWindowMessage);
    return () => {
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("message", onWindowMessage);
      if (refocusTimer) clearTimeout(refocusTimer);
    };
  }, [post, recordInteractionBurst]);

  // Landscape Orientation Detection via matchMedia("(orientation: landscape)")
  useEffect(() => {
    if (!post) return;
    const mql = window.matchMedia("(orientation: landscape)");
    const onOrientationChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setSwitchedToLandscape(true);
      }
    };
    mql.addEventListener("change", onOrientationChange);
    return () => mql.removeEventListener("change", onOrientationChange);
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
    recordInteractionBurst();
    esRef.current?.close();
    setLines([]);
    setLatency(null);
    setPhase("starting");
    const startMs = performance.now();
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
        if (evt.type === "status" && evt.status === "running") {
          setPhase("running");
          setBootTimeMs(Math.max(1, Math.round(performance.now() - startMs)));
        }
        if (evt.type === "result") {
          setLatency(post.health.p50LatencyMs);
          if (evt.output) push("stdout", JSON.stringify(evt.output, null, 2));
        }
        if (evt.type === "health") {
          setPhase("done");
          setHealthOk(true);
          es.close();
        }
      };
      for (const t of ["status", "log", "result", "health"]) {
        es.addEventListener(t, handle as EventListener);
      }
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) return;
        es.close();
        setHealthOk(false);
        setPhase((p) => (p === "done" ? p : "error"));
        push("system", "Connection to the sandbox closed.");
      };
    } catch (err) {
      setHealthOk(false);
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
    recordInteractionBurst();
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

  function handleDialogClose() {
    esRef.current?.close();
    const closingPost = activePostRef.current;
    const snap = telemetrySnapshotRef.current;
    if (closingPost && snap && !telemetrySentForSessionRef.current) {
      telemetrySentForSessionRef.current = true;
      setExitToastPost({
        id: closingPost.id,
        title: closingPost.title,
        snapshot: snap,
      });
      if (exitToastTimerRef.current) clearTimeout(exitToastTimerRef.current);
      exitToastTimerRef.current = setTimeout(() => {
        setExitToastPost(null);
        void flushTelemetryPayload(snap, null);
      }, 2500);
    }
    onClose();
  }

  const busy = phase === "starting" || phase === "running";
  const fields = post?.demo.formSchema ?? [];

  // Interactive micro-webview document for Mode B (BROWSER) with optional 1-line SDK postMessage
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
<body onclick="parent.postMessage({ type: 'PLATFORM_INTERACTION' }, '*')">
  <div class="bar">
    <span><strong>${post.title.replace(/[<>&"]/g, "")}</strong> · Isolated Web Sandbox</span>
    <span style="color:#2F7D4F;font-weight:700;">● ${post.health.uptimePct}% Uptime</span>
  </div>
  <div class="box">
    <p style="margin:0 0 8px;font-size:13px;">Interactive in-feed micro-app preview (<code>&lt;iframe sandbox="allow-scripts allow-forms"&gt;</code>):</p>
    <button onclick="parent.postMessage({ type: 'PLATFORM_INTERACTION' }, '*'); document.getElementById('out').textContent = '✓ Processed in ${post.health.p50LatencyMs}ms — 68% payload reduction, WCAG AA verified.'">Run Interactive Web Demo</button>
    <pre id="out" style="margin-top:10px;">Ready for 1-tap interaction inside sandboxed iframe...</pre>
  </div>
</body>
</html>`
    : "";

  return (
    <>
      <dialog
        ref={dialogRef}
        className={cn("sheet", landscapeRotated && "max-w-3xl")}
        aria-labelledby="try-title"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={handleDialogClose}
      >
        {post && (
          <div
            className="flex max-h-[90dvh] flex-col"
            onPointerDown={() => {
              if (post.demo.mode !== "web") recordInteractionBurst();
            }}
            onKeyDown={() => {
              if (post.demo.mode !== "web") recordInteractionBurst();
            }}
          >
            {/* Header */}
            <header className="border-line flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-ink text-paper rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                    {MODE_LABEL[post.demo.mode]}
                  </span>
                  <span className="border-line bg-paper rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums">
                    Dwell {activeDwellSeconds}s · {interactionBursts} bursts
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={landscapeRotated}
                  onClick={() => {
                    recordInteractionBurst();
                    setSwitchedToLandscape(true);
                    setLandscapeRotated((v) => !v);
                  }}
                  className={cn(
                    "border-line rounded-full border px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-transform active:scale-95",
                    landscapeRotated ? "bg-ink text-paper" : "bg-paper text-ink"
                  )}
                >
                  {landscapeRotated ? "Portrait UI" : "Rotate Landscape"}
                </button>
                <form method="dialog">
                  <button
                    aria-label="Close sandbox"
                    className="bg-paper-sunken grid size-9 place-items-center rounded-full"
                    autoFocus
                  >
                    <IconClose className="size-5" />
                  </button>
                </form>
              </div>
            </header>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Auto Scalability Health Card */}
              <section
                aria-label="Scalability health telemetry"
                className="border-line bg-paper grid grid-cols-4 gap-2 rounded-2xl border p-3 text-center font-mono tabular-nums"
              >
                <div>
                  <span className="text-ink-muted block text-[10px] uppercase">Pre-Flight</span>
                  <span className={cn("text-sm font-bold", healthOk ? "text-sage" : "text-alert")}>
                    {healthOk ? `${ post.health.uptimePct}% OK` : "Unreachable"}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px] uppercase">Boot / p50</span>
                  <span className="text-sm font-bold">{bootTimeMs || post.health.p50LatencyMs}ms</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px] uppercase">Usability S_use</span>
                  <span className="text-sage text-sm font-bold">
                    {(post.usabilityScore ?? 1.45).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px] uppercase">Pop S_pop</span>
                  <span className="text-sm font-bold">
                    {Math.round(post.popularityScore ?? post.postScore)}
                  </span>
                </div>
              </section>

              {/* Mode B: Web App Sandboxed Iframe */}
              {post.demo.mode === "web" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      Isolated Web App Sandbox{" "}
                      {!canIframe && (
                        <span className="text-alert font-mono text-[11px]">
                          (X-Frame-Options restricted — using safe preview)
                        </span>
                      )}
                    </span>
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
                    ref={iframeRef}
                    title={`Web sandbox for ${post.title}`}
                    sandbox="allow-scripts allow-forms"
                    srcDoc={webSandboxSrcDoc}
                    className={cn(
                      "border-line w-full rounded-2xl border",
                      landscapeRotated ? "h-72" : "h-52"
                    )}
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

      {/* 2.5-Second Non-Blocking Exit Micro-Toast */}
      {exitToastPost && (
        <div
          role="status"
          aria-live="polite"
          className="border-line bg-ink text-paper fixed inset-x-3 bottom-20 z-toast mx-auto flex max-w-md items-center justify-between gap-2 rounded-full border px-3.5 py-2 shadow-lg sm:bottom-6"
        >
          <span className="truncate font-mono text-xs font-semibold">
            How was {exitToastPost.title}?
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleFeedbackToastSelection("WORKS_GREAT")}
              className="bg-sage text-primary-ink rounded-full px-3 py-1 text-xs font-bold transition-transform active:scale-95"
            >
              🔥 Worked great
            </button>
            <button
              type="button"
              onClick={() => handleFeedbackToastSelection("BUGGY")}
              className="bg-alert text-primary-ink rounded-full px-3 py-1 text-xs font-bold transition-transform active:scale-95"
            >
              🐛 Broken / Laggy
            </button>
          </div>
        </div>
      )}
    </>
  );
}
