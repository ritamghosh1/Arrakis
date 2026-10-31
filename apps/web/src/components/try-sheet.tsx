"use client";

import type {
  FormFieldSchema,
  Post,
  PreflightResponse,
  QuickFeedbackTag,
  SandboxProjectType,
  SseStreamEvent,
  TelemetryPayload,
  TrialRunStatus,
} from "@arrakis/contracts";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CheckCircleIcon,
  CloseIcon,
  CopyIcon,
  PlayIcon,
  SparklesIcon,
  TerminalIcon,
} from "./icons";
import { InAppBrowser } from "./in-app-browser";
import { queueEvent } from "@/lib/events";
import { VIEWER_ID, cn } from "@/lib/utils";

interface TrySheetProps {
  post: Post | null;
  onClose: () => void;
  onTrialCompleted?: (postId: string, xpEarned: number) => void;
  onVerifiedTrial?: (postId: string, xpAwarded: number) => void;
}

const DEFAULT_FIELDS: FormFieldSchema[] = [
  {
    name: "sample_input",
    label: "Sample Input",
    type: "text",
    required: true,
    placeholder: "Enter sample text or payload...",
    defaultValue: "Senior Backend Engineer · Rust, Postgres, Docker",
  },
];

const MODE_BADGE: Record<string, string> = {
  container: "Live Container",
  api: "Interactive API",
  web: "Web App",
  handoff: "Desktop App",
};

export function TrySheet({
  post,
  onClose,
  onTrialCompleted,
  onVerifiedTrial,
}: TrySheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const [viewTab, setViewTab] = useState<"browser" | "cli">("browser");
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [status, setStatus] = useState<TrialRunStatus | "idle">("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<SseStreamEvent[]>([]);
  const [resultOutput, setResultOutput] = useState<unknown>(null);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // Outer-Shell Telemetry Physics state & refs
  const [healthOk, setHealthOk] = useState<boolean>(true);
  const [bootTimeMs, setBootTimeMs] = useState<number>(0);
  const [activeDwellSeconds, setActiveDwellSeconds] = useState<number>(0);
  const [interactionBursts, setInteractionBursts] = useState<number>(0);
  const [switchedToLandscape, setSwitchedToLandscape] = useState<boolean>(false);

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

  // Quick Feedback state
  const [worked, setWorked] = useState<boolean>(true);
  const [wouldUse, setWouldUse] = useState<boolean>(true);
  const [bugNote, setBugNote] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const fields =
    post?.demo.formSchema && post.demo.formSchema.length > 0
      ? post.demo.formSchema
      : DEFAULT_FIELDS;

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
      project_type: viewTab === "browser" || post.demo.mode === "web" ? "BROWSER" : "CONTAINER",
      health_ok: healthOk,
      boot_time_ms: bootTimeMs || post.health.p50LatencyMs,
      switched_to_landscape: switchedToLandscape,
      active_dwell_seconds: activeDwellSeconds,
      interaction_bursts: interactionBursts,
    };
  }, [
    post,
    viewTab,
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
          onTrialCompleted?.(snapshot.project_id, 40);
          onVerifiedTrial?.(snapshot.project_id, 40);
        }
      } catch {
        // non-blocking telemetry
      }
    },
    [onTrialCompleted, onVerifiedTrial]
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

  const handlePreflightResult = useCallback((pf: PreflightResponse) => {
    setHealthOk(pf.health_ok);
    setBootTimeMs(pf.latency_ms);
  }, []);

  // Modal open lifecycle
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (post) {
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
      setHealthOk(true);
      setBootTimeMs(post.health.p50LatencyMs);
      setViewTab("browser");

      const initial: Record<string, string | number | boolean> = {};
      const schema =
        post.demo.formSchema && post.demo.formSchema.length > 0
          ? post.demo.formSchema
          : DEFAULT_FIELDS;
      for (const f of schema) {
        if (f.defaultValue !== undefined) {
          initial[f.name] = f.defaultValue;
        } else if (f.type === "select" && f.options?.[0]) {
          initial[f.name] = f.options[0];
        } else if (f.type === "boolean") {
          initial[f.name] = true;
        } else {
          initial[f.name] = "";
        }
      }
      setValues(initial);
      setStatus("idle");
      setRunId(`run_${Date.now().toString(36)}`);
      setLogs([]);
      setResultOutput(null);
      setReviewSubmitted(false);
      setBugNote("");

      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
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

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  function handleDialogClose() {
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

  async function handleRunDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!post) return;

    recordInteractionBurst();
    const startMs = performance.now();
    setStatus("starting");
    setLogs([]);
    setResultOutput(null);
    setReviewSubmitted(false);
    queueEvent({ type: "try", postId: post.id });

    try {
      const res = await fetch(`/api/try/${encodeURIComponent(post.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: values }),
      });

      const run = await res.json();
      const activeRunId = run.id ?? `run_${Date.now().toString(36)}`;
      setRunId(activeRunId);

      const streamUrl = `/api/try/${encodeURIComponent(activeRunId)}/stream?postId=${encodeURIComponent(post.id)}`;
      const es = new EventSource(streamUrl);

      const handleEvent = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data) as SseStreamEvent;
          setLogs((prev) => [...prev.slice(-150), parsed]);
          if (parsed.status) {
            setStatus(parsed.status);
            if (parsed.status === "running") {
              setBootTimeMs(Math.max(1, Math.round(performance.now() - startMs)));
            }
          }
          if (parsed.type === "result" && parsed.output) {
            setResultOutput(parsed.output);
          }
          if (parsed.type === "health" || parsed.status === "succeeded") {
            setStatus("succeeded");
            setHealthOk(true);
            es.close();
          }
        } catch {
          // Ignore malformed event
        }
      };

      es.addEventListener("status", handleEvent);
      es.addEventListener("log", handleEvent);
      es.addEventListener("result", handleEvent);
      es.addEventListener("health", handleEvent);
      es.onerror = () => {
        setStatus((curr) => (curr === "idle" ? "failed" : "succeeded"));
        es.close();
      };
    } catch {
      setHealthOk(false);
      setStatus("failed");
    }
  }

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!post || submittingReview || reviewSubmitted) return;

    recordInteractionBurst();
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: runId ?? `run_${Date.now().toString(36)}`,
          postId: post.id,
          worked,
          wouldUse,
          bug: bugNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      const xp = data.xpAwarded ?? 125;
      setReviewSubmitted(true);
      queueEvent({ type: "review", postId: post.id, value: 1 });
      onTrialCompleted?.(post.id, xp);
      onVerifiedTrial?.(post.id, xp);
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleCopyOutput() {
    const text = resultOutput
      ? JSON.stringify(resultOutput, null, 2)
      : logs.map((l) => l.line).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={handleDialogClose}
        onClick={(e) => {
          if (e.target === dialogRef.current) handleDialogClose();
        }}
        className="fixed inset-x-0 bottom-0 top-auto sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-sheet m-0 w-full sm:max-w-[1040px] max-h-[92dvh] rounded-t-2xl sm:rounded-2xl border border-border bg-surface text-ink shadow-2xl p-0 overflow-hidden flex flex-col"
      >
        {post && (
          <div
            className="flex flex-1 flex-col overflow-hidden"
            onPointerDown={() => {
              if (viewTab !== "browser") recordInteractionBurst();
            }}
            onKeyDown={() => {
              if (viewTab !== "browser") recordInteractionBurst();
            }}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-dune/60 px-5 py-3.5 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-dune">
                    <TerminalIcon className="size-3.5 text-accent-soft" />
                    {MODE_BADGE[post.demo.mode] ?? "Live Demo"}
                  </span>
                  <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-muted tabular-nums">
                    Dwell {activeDwellSeconds}s · {interactionBursts} bursts
                  </span>
                </div>
                <h2 id={titleId} className="font-display text-base sm:text-lg font-bold text-ink truncate">
                  {post.title}
                </h2>
              </div>

              {/* View Mode Switcher: In-App Browser vs CLI / API Sandbox */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setViewTab("browser")}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                      viewTab === "browser"
                        ? "bg-ink text-dune shadow-sm"
                        : "text-muted hover:text-ink"
                    )}
                  >
                    🌐 In-App Browser
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab("cli")}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                      viewTab === "cli"
                        ? "bg-ink text-dune shadow-sm"
                        : "text-muted hover:text-ink"
                    )}
                  >
                    ⚡ CLI / API Stream
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDialogClose}
                  aria-label="Close live demo sheet"
                  className="rounded-lg p-1.5 text-muted hover:bg-border/50 hover:text-ink transition-colors shrink-0"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {viewTab === "browser" ? (
                <InAppBrowser
                  post={post}
                  iframeRef={iframeRef}
                  onInteract={recordInteractionBurst}
                  onPreflightResult={handlePreflightResult}
                  className="min-h-[480px]"
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left: Interactive Inputs */}
                  <form onSubmit={handleRunDemo} className="lg:col-span-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold text-ink">Demo Inputs</h3>
                      <span className="text-[11px] text-muted">Instant execution</span>
                    </div>

                    <div className="space-y-3">
                      {fields.map((field) => {
                        const inputId = `try-field-${field.name}`;
                        return (
                          <div key={field.name} className="space-y-1.5">
                            <label htmlFor={inputId} className="block text-xs font-semibold text-ink">
                              {field.label}
                            </label>

                            {field.type === "select" && field.options ? (
                              <select
                                id={inputId}
                                value={String(values[field.name] ?? "")}
                                onChange={(e) =>
                                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                                }
                                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                              >
                                {field.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : field.type === "json" ? (
                              <textarea
                                id={inputId}
                                rows={3}
                                required={field.required}
                                placeholder={field.placeholder}
                                value={String(values[field.name] ?? "")}
                                onChange={(e) =>
                                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                                }
                                className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-ink focus:border-accent focus:outline-none"
                              />
                            ) : (
                              <input
                                id={inputId}
                                type={field.type === "number" ? "number" : "text"}
                                required={field.required}
                                placeholder={field.placeholder}
                                value={String(values[field.name] ?? "")}
                                onChange={(e) =>
                                  setValues((prev) => ({
                                    ...prev,
                                    [field.name]:
                                      field.type === "number"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="submit"
                      disabled={status === "starting" || status === "running"}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60 transition-colors shadow-sm"
                    >
                      <PlayIcon className="size-4" />
                      <span>
                        {status === "starting" || status === "running"
                          ? "Running Container..."
                          : status === "succeeded"
                            ? "Run Again"
                            : "Run Container Stream"}
                      </span>
                    </button>
                  </form>

                  {/* Right: Live Output Console */}
                  <div className="lg:col-span-7 flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm font-bold text-ink">
                          Live Container / API Stream
                        </h3>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                            status === "succeeded"
                              ? "bg-sage-soft text-sage"
                              : status === "running" || status === "starting"
                                ? "bg-amber-soft text-amber"
                                : "bg-dune text-muted"
                          )}
                        >
                          {status === "idle" ? "Ready" : status === "succeeded" ? "Completed" : status}
                        </span>
                      </div>

                      {(logs.length > 0 || resultOutput !== null) && (
                        <button
                          type="button"
                          onClick={handleCopyOutput}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-dune px-2.5 py-1 text-xs font-medium text-ink hover:bg-border/40"
                        >
                          <CopyIcon className="size-3.5" />
                          <span>{copiedOutput ? "Copied" : "Copy"}</span>
                        </button>
                      )}
                    </div>

                    <div
                      ref={terminalRef}
                      role="log"
                      aria-live="polite"
                      className="rounded-xl bg-ink text-dune p-4 font-mono text-xs leading-relaxed h-[320px] overflow-y-auto space-y-1.5 border border-ink"
                    >
                      {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-dune/60 space-y-1.5">
                          <TerminalIcon className="size-6 text-accent-soft" />
                          <p>Click &ldquo;Run Container Stream&rdquo; to inspect raw stdout/stderr logs.</p>
                        </div>
                      ) : (
                        logs.map((evt, idx) => (
                          <div
                            key={`${evt.timestamp}-${idx}`}
                            className={cn(
                              "break-words",
                              evt.stream === "system"
                                ? "text-dune/65"
                                : evt.type === "result"
                                  ? "text-sage-soft font-semibold"
                                  : "text-dune"
                            )}
                          >
                            {evt.line}
                          </div>
                        ))
                      )}

                      {resultOutput !== null && (
                        <pre className="mt-3 rounded-lg bg-surface/10 p-3 text-[11px] text-dune overflow-x-auto border border-dune/15">
                          {JSON.stringify(resultOutput, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Compact Quick Feedback Footer (always available in In-App Browser or after CLI run) */}
              <div className="rounded-2xl border border-sage/40 bg-sage-soft/45 p-3.5 sm:p-4">
                {reviewSubmitted ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircleIcon className="size-5 text-sage shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-ink">
                          Thanks for testing and reviewing this build!
                        </p>
                        <p className="text-xs text-muted">
                          Your hands-on review has been recorded for @{post.author.handle}.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDialogClose}
                      className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-dune"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmitFeedback}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="size-4 text-sage shrink-0" />
                      <span className="text-xs font-bold text-ink">
                        Rate @{post.author.handle}&apos;s app:
                      </span>
                      <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
                        <button
                          type="button"
                          onClick={() => setWorked(true)}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                            worked ? "bg-sage text-white" : "text-muted hover:text-ink"
                          )}
                        >
                          Worked
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorked(false)}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                            !worked ? "bg-crimson text-white" : "text-muted hover:text-ink"
                          )}
                        >
                          Buggy
                        </button>
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer ml-1">
                        <input
                          type="checkbox"
                          checked={wouldUse}
                          onChange={(e) => setWouldUse(e.target.checked)}
                          className="accent-sage rounded"
                        />
                        <span>Would use again</span>
                      </label>
                    </div>

                    <div className="flex flex-1 min-w-[220px] items-center gap-2">
                      <input
                        type="text"
                        placeholder="Optional note or feature idea for the builder..."
                        value={bugNote}
                        onChange={(e) => setBugNote(e.target.value)}
                        className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="rounded-xl bg-sage px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-95 transition-opacity shrink-0"
                      >
                        {submittingReview ? "Saving..." : "Submit Feedback"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </dialog>

      {/* 2.5-Second Non-Blocking Exit Micro-Toast */}
      {exitToastPost && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-20 z-toast mx-auto flex max-w-md items-center justify-between gap-2 rounded-full border border-border bg-ink px-4 py-2.5 text-dune shadow-xl sm:bottom-6"
        >
          <span className="truncate font-mono text-xs font-semibold">
            How was {exitToastPost.title}?
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleFeedbackToastSelection("WORKS_GREAT")}
              className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-white transition-transform active:scale-95"
            >
              🔥 Worked great
            </button>
            <button
              type="button"
              onClick={() => handleFeedbackToastSelection("BUGGY")}
              className="rounded-full bg-crimson px-3 py-1 text-xs font-bold text-white transition-transform active:scale-95"
            >
              🐛 Broken / Laggy
            </button>
          </div>
        </div>
      )}
    </>
  );
}
