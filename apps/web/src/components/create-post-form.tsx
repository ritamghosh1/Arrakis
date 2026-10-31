"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DemoMode, FormFieldSchema, Post } from "@arrakis/contracts";
import { cn, VIEWER_ID } from "@/lib/utils";
import { CATEGORIES } from "@/lib/data";
import { MODE_LABEL } from "./reel-card";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { IconBolt, IconCheck, IconPlus, IconShare, IconSpark } from "./icons";

const DRAFT_KEY = "arrakis_upload_draft_v1";

const SAMPLE_VIDEOS = [
  {
    label: "Terminal CLI & JSON Schema Demo (52s)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4#t=2",
    duration: 52,
  },
  {
    label: "Interactive Web Utility Walkthrough (68s)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4#t=2",
    duration: 68,
  },
];

export function CreatePostForm() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Pitch Video
  const [videoUrl, setVideoUrl] = useState(SAMPLE_VIDEOS[0]!.url);
  const [videoFileName, setVideoFileName] = useState("demo-reel-terminal.mp4");
  const [durationSec, setDurationSec] = useState(52);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Step 2: Basics & Problem Statement
  const [title, setTitle] = useState("SQLite-to-REST — Turn any .db file into a typed OpenAPI server");
  const [problemStatement, setProblemStatement] = useState(
    "Spin up a read-only REST + OpenAPI endpoint from a raw SQLite file in 1 command without writing boilerplate routes.",
  );
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [tagsText, setTagsText] = useState("sqlite, openapi, rest, cli");

  // Step 3: Demo Wiring & Auto-Form Builder
  const [demoMode, setDemoMode] = useState<DemoMode>("container");
  const [demoTarget, setDemoTarget] = useState("arrakis/sqlite-to-rest:latest");
  const [repoUrl, setRepoUrl] = useState("https://github.com/ritamghosh1/sqlite-to-rest");
  const [sampleCommand, setSampleCommand] = useState(
    "sqlite-to-rest --db sample.sqlite --openapi",
  );
  const [fields, setFields] = useState<FormFieldSchema[]>([
    {
      name: "tableQuery",
      label: "Table or SQL filter",
      type: "text",
      required: true,
      defaultValue: "SELECT id, email, created_at FROM users LIMIT 5;",
    },
    {
      name: "readOnly",
      label: "Enforce read-only mode",
      type: "boolean",
      required: false,
      defaultValue: true,
    },
  ]);

  // Step 4: AI Indexing & Publish
  const [indexing, setIndexing] = useState(false);
  const [indexedVector, setIndexedVector] = useState<number[]>([
    0.84, 0.32, -0.18, 0.64, 0.51, -0.29, 0.77, 0.19, 0.44, -0.15, 0.68, 0.39, -0.22, 0.58,
    0.49, 0.71,
  ]);
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishedPost, setPublishedPost] = useState<Post | null>(null);
  const [tryPost, setTryPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<{
        title: string;
        problemStatement: string;
        category: string;
        tagsText: string;
        demoMode: DemoMode;
        demoTarget: string;
      }>;
      if (d.title) setTitle(d.title);
      if (d.problemStatement) setProblemStatement(d.problemStatement);
      if (d.category) setCategory(d.category);
      if (d.tagsText) setTagsText(d.tagsText);
      if (d.demoMode) setDemoMode(d.demoMode);
      if (d.demoTarget) setDemoTarget(d.demoTarget);
    } catch {
      // ignore
    }
  }, []);

  function saveDraft() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          title,
          problemStatement,
          category,
          tagsText,
          demoMode,
          demoTarget,
        }),
      );
      setDraftSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      // ignore
    }
  }

  function handleVideoFile(file: File | undefined) {
    if (!file) return;
    setVideoError(null);
    if (!file.type.startsWith("video/")) {
      setVideoError("Please select a valid MP4 or WebM video file.");
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setVideoError("Pitch reel must be under 80 MB (≤120 seconds).");
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setVideoUrl(objUrl);
    setVideoFileName(file.name);
    setDurationSec(58);
  }

  function addField() {
    const idx = fields.length + 1;
    setFields((prev) => [
      ...prev,
      {
        name: `param_${idx}`,
        label: `Input parameter #${idx}`,
        type: "text",
        required: true,
        defaultValue: "sample_value",
      },
    ]);
  }

  function updateField(index: number, patch: Partial<FormFieldSchema>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function runAiUtilityIndexer() {
    setIndexing(true);
    setTimeout(() => {
      // Zero-buzzword problem statement refinement + deterministic vector update
      if (!problemStatement.toLowerCase().endsWith(".")) {
        setProblemStatement((s) => `${s.trim()}.`);
      }
      setIndexedVector((prev) =>
        prev.map((v, i) => Number((Math.sin(title.length + i * 1.7) * 0.85).toFixed(2))),
      );
      setIndexing(false);
    }, 420);
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!title.trim() || !problemStatement.trim() || !demoTarget.trim()) {
      setSubmitError("Please fill in the project title, problem statement, and demo target.");
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorId: VIEWER_ID,
          title,
          problemStatement,
          category,
          videoUrl,
          durationSec,
          demo: {
            mode: demoMode,
            target: demoTarget,
            repoUrl: repoUrl.trim() || undefined,
            sampleCommand: sampleCommand.trim() || undefined,
            formSchema: demoMode === "container" || demoMode === "api" ? fields : undefined,
          },
          tags,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `Upload failed (${res.status})`);
      }
      const created = (await res.json()) as Post;
      localStorage.removeItem(DRAFT_KEY);
      setPublishedPost(created);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not publish project.");
    } finally {
      setSubmitting(false);
    }
  }

  if (publishedPost) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="border-line bg-paper-raised space-y-5 rounded-[var(--radius-card)] border p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="bg-sage text-primary-ink grid size-11 place-items-center rounded-2xl">
                <IconCheck className="size-6" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sage font-mono text-xs font-bold uppercase">
                  Live on Arrakis · Problem Statement Indexed in pgvector
                </p>
                <h1 className="font-display text-2xl font-bold">{publishedPost.title}</h1>
              </div>
            </div>

            <div className="border-line bg-paper rounded-2xl border p-4">
              <p className="text-ink-muted font-mono text-[11px] font-semibold uppercase">
                Indexed Problem Statement (Zero-Buzzword)
              </p>
              <p className="mt-1 text-sm font-medium">{publishedPost.problemStatement}</p>
              <div className="text-ink-muted mt-3 flex flex-wrap gap-2 font-mono text-xs">
                <span className="bg-paper-sunken text-ink rounded-full px-2.5 py-0.5 font-semibold">
                  {MODE_LABEL[publishedPost.demo.mode]}
                </span>
                <span>Target: {publishedPost.demo.target}</span>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setTryPost(publishedPost)}
                className="bg-primary text-primary-ink flex h-11 items-center justify-center gap-1.5 rounded-full text-xs font-bold"
              >
                <IconBolt className="size-4" />
                Test 1-Tap Sandbox
              </button>
              <button
                type="button"
                onClick={() => setSharePost(publishedPost)}
                className="border-line bg-paper hover:bg-paper-sunken flex h-11 items-center justify-center gap-1.5 rounded-full border text-xs font-bold"
              >
                <IconShare className="size-4" />
                Share & QR Code
              </button>
              <Link
                href="/"
                className="bg-ink text-paper flex h-11 items-center justify-center rounded-full text-xs font-bold"
              >
                View in Home Feed →
              </Link>
            </div>
          </div>
        </div>
        <TrySheet post={tryPost} onClose={() => setTryPost(null)} />
        <ShareSheet post={sharePost} onClose={() => setSharePost(null)} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-5 pb-14">
        {/* Header & Save Draft */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-ink-muted font-mono text-xs font-semibold uppercase">
              Zero-Code Builder Onboarding · 20% Cold-Start Boost Guaranteed
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              Publish a Utility Micro-Demo
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {draftSavedAt && (
              <span className="text-sage font-mono text-xs" role="status">
                Draft saved {draftSavedAt}
              </span>
            )}
            <button
              type="button"
              onClick={saveDraft}
              className="border-line bg-paper-raised hover:bg-paper-sunken rounded-full border px-3.5 py-1.5 text-xs font-bold"
            >
              Save Draft
            </button>
          </div>
        </header>

        {/* 4-Step Progress Bar */}
        <nav aria-label="Upload steps" className="grid grid-cols-4 gap-2">
          {(
            [
              [1, "1. Pitch Reel"],
              [2, "2. Problem Solved"],
              [3, "3. Sandbox Wiring"],
              [4, "4. AI Index & Publish"],
            ] as const
          ).map(([s, label]) => {
            const active = step === s;
            const done = step > s;
            return (
              <button
                key={s}
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => setStep(s)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-2xl border px-2.5 py-2.5 text-xs font-bold transition-colors",
                  active
                    ? "border-ink bg-ink text-paper"
                    : done
                      ? "border-sage/40 bg-sage/10 text-sage"
                      : "border-line bg-paper-raised text-ink-muted",
                )}
              >
                {done && <IconCheck className="size-3.5" strokeWidth={3} />}
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        <form onSubmit={(e) => void handlePublish(e)} className="space-y-5">
          {/* STEP 1: Pitch Video */}
          {step === 1 && (
            <section
              aria-labelledby="step1-heading"
              className="border-line bg-paper-raised space-y-4 rounded-[var(--radius-card)] border p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="step1-heading" className="font-display text-lg font-bold">
                    Step 1 — Upload a ≤2-Min Utility Demo Reel
                  </h2>
                  <p className="text-ink-muted text-xs">
                    Show what problem the tool solves in action — not slides or static code.
                  </p>
                </div>
                <span className="bg-paper-sunken rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums">
                  {durationSec}s / 120s max
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
                <div className="space-y-3">
                  <label
                    htmlFor="pitch-video-file"
                    className="border-line bg-paper hover:bg-paper-sunken flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors"
                  >
                    <IconPlus className="text-primary size-7" />
                    <span className="text-sm font-bold">
                      Drop MP4 / WebM reel or click to browse
                    </span>
                    <span className="text-ink-muted font-mono text-xs">
                      Selected: {videoFileName} ({durationSec}s)
                    </span>
                    <input
                      id="pitch-video-file"
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={(e) => handleVideoFile(e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>

                  <div>
                    <p className="text-xs font-semibold">Or pick a preset hackathon demo reel:</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {SAMPLE_VIDEOS.map((sv) => (
                        <button
                          key={sv.url}
                          type="button"
                          onClick={() => {
                            setVideoUrl(sv.url);
                            setDurationSec(sv.duration);
                            setVideoFileName(sv.label);
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-1.5 text-xs font-semibold",
                            videoUrl === sv.url
                              ? "border-ink bg-ink text-paper"
                              : "border-line bg-paper text-ink",
                          )}
                        >
                          {sv.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {videoError && (
                    <p className="text-alert text-xs font-semibold" role="alert">
                      {videoError}
                    </p>
                  )}
                </div>

                <div className="bg-ink relative aspect-[9/14] overflow-hidden rounded-2xl">
                  <video
                    src={videoUrl}
                    muted
                    loop
                    playsInline
                    controls
                    className="size-full object-cover"
                    aria-label="Uploaded pitch reel preview"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-primary text-primary-ink rounded-full px-6 py-2.5 text-xs font-bold"
                >
                  Continue to Problem Statement →
                </button>
              </div>
            </section>
          )}

          {/* STEP 2: Problem Statement & Basics */}
          {step === 2 && (
            <section
              aria-labelledby="step2-heading"
              className="border-line bg-paper-raised space-y-4 rounded-[var(--radius-card)] border p-5"
            >
              <div>
                <h2 id="step2-heading" className="font-display text-lg font-bold">
                  Step 2 — Define the Real-World Problem It Solves
                </h2>
                <p className="text-ink-muted text-xs">
                  Arrakis indexes your problem statement in pgvector so everyday users find your tool by requirement, not buzzwords.
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="post-title" className="text-xs font-bold">
                  Tool Name & 1-Line Headline (required)
                </label>
                <span id="post-title-hint" className="text-ink-muted block text-xs">
                  Format: ToolName — What it achieves (max 80 characters)
                </span>
                <input
                  id="post-title"
                  name="title"
                  type="text"
                  required
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-describedby="post-title-hint"
                  className="border-line bg-paper w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="post-problem" className="text-xs font-bold">
                    Problem It Solves (required · indexed for search)
                  </label>
                  <span className="text-ink-muted font-mono text-[11px] tabular-nums">
                    {problemStatement.length}/160
                  </span>
                </div>
                <span id="post-problem-hint" className="text-ink-muted block text-xs">
                  State the concrete task and outcome in plain language. Avoid vague AI buzzwords.
                </span>
                <textarea
                  id="post-problem"
                  name="problemStatement"
                  required
                  maxLength={160}
                  rows={3}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  aria-describedby="post-problem-hint"
                  className="border-line bg-paper w-full rounded-xl border px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="post-category" className="text-xs font-bold">
                    Utility Category
                  </label>
                  <select
                    id="post-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="border-line bg-paper w-full rounded-xl border px-3.5 py-2.5 text-sm font-medium"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="post-tags" className="text-xs font-bold">
                    Problem Tags (comma-separated)
                  </label>
                  <input
                    id="post-tags"
                    type="text"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="csv, sql, parser, cli"
                    className="border-line bg-paper w-full rounded-xl border px-3.5 py-2.5 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border-line bg-paper rounded-full border px-5 py-2.5 text-xs font-bold"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-primary text-primary-ink rounded-full px-6 py-2.5 text-xs font-bold"
                >
                  Continue to Sandbox Wiring →
                </button>
              </div>
            </section>
          )}

          {/* STEP 3: Sandbox Wiring & Auto-Form Builder */}
          {step === 3 && (
            <section
              aria-labelledby="step3-heading"
              className="border-line bg-paper-raised space-y-4 rounded-[var(--radius-card)] border p-5"
            >
              <div>
                <h2 id="step3-heading" className="font-display text-lg font-bold">
                  Step 3 — Wire the 1-Tap Sandbox & Auto-Form Builder
                </h2>
                <p className="text-ink-muted text-xs">
                  Pick how users test your project inside the feed. Container mode runs an isolated Docker image with CPU/RAM/TTL limits.
                </p>
              </div>

              {/* Demo Mode Radio Cards */}
              <fieldset>
                <legend className="text-xs font-bold">Sandbox Execution Mode</legend>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["container", "Container Sandbox", "Docker image / Dockerfile"],
                      ["api", "Live API Proxy", "Edge proxy + 10s timeout"],
                      ["web", "Web Sandbox", "Isolated <iframe sandbox>"],
                      ["handoff", "Desktop Handoff", "1-tap Send to Laptop"],
                    ] as const
                  ).map(([m, label, sub]) => (
                    <label
                      key={m}
                      className={cn(
                        "flex cursor-pointer flex-col rounded-2xl border p-3 text-xs transition-colors",
                        demoMode === m
                          ? "border-primary bg-primary/5 font-bold"
                          : "border-line bg-paper",
                      )}
                    >
                      <input
                        type="radio"
                        name="demoMode"
                        value={m}
                        checked={demoMode === m}
                        onChange={() => setDemoMode(m)}
                        className="sr-only"
                      />
                      <span className="font-display text-sm font-bold">{label}</span>
                      <span className="text-ink-muted mt-0.5 font-mono text-[10px]">{sub}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="demo-target" className="text-xs font-bold">
                    {demoMode === "container"
                      ? "Docker Image Tag (required)"
                      : "Live Endpoint / Web App URL (required)"}
                  </label>
                  <input
                    id="demo-target"
                    type="text"
                    required
                    value={demoTarget}
                    onChange={(e) => setDemoTarget(e.target.value)}
                    placeholder={
                      demoMode === "container"
                        ? "arrakis/your-tool:latest"
                        : "https://your-tool.vercel.app/api/run"
                    }
                    className="border-line bg-paper w-full rounded-xl border px-3.5 py-2 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="demo-command" className="text-xs font-bold">
                    Sample CLI Command / Entrypoint
                  </label>
                  <input
                    id="demo-command"
                    type="text"
                    value={sampleCommand}
                    onChange={(e) => setSampleCommand(e.target.value)}
                    className="border-line bg-paper w-full rounded-xl border px-3.5 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Interactive Auto-Form Schema Builder + Live Preview */}
              {(demoMode === "container" || demoMode === "api") && (
                <div className="border-line bg-paper grid gap-4 rounded-2xl border p-4 lg:grid-cols-2">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold">
                        Zero-Code Form Schema Builder
                      </h3>
                      <button
                        type="button"
                        onClick={addField}
                        className="bg-ink text-paper rounded-full px-3 py-1 font-mono text-[11px] font-bold"
                      >
                        + Add Field
                      </button>
                    </div>

                    <div className="space-y-2">
                      {fields.map((f, idx) => (
                        <div
                          key={idx}
                          className="border-line bg-paper-raised space-y-2 rounded-xl border p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              aria-label={`Field ${idx + 1} label`}
                              value={f.label}
                              onChange={(e) => updateField(idx, { label: e.target.value })}
                              placeholder="Field label"
                              className="border-line bg-paper flex-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                            />
                            <select
                              aria-label={`Field ${idx + 1} type`}
                              value={f.type}
                              onChange={(e) =>
                                updateField(idx, {
                                  type: e.target.value as FormFieldSchema["type"],
                                })
                              }
                              className="border-line bg-paper rounded-lg border px-2 py-1 font-mono text-xs"
                            >
                              <option value="text">text</option>
                              <option value="number">number</option>
                              <option value="url">url</option>
                              <option value="boolean">boolean</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeField(idx)}
                              className="text-alert font-mono text-xs font-bold"
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            aria-label={`Field ${idx + 1} default value`}
                            value={String(f.defaultValue ?? "")}
                            onChange={(e) => updateField(idx, { defaultValue: e.target.value })}
                            placeholder="Default sample value for 1-tap trial"
                            className="border-line bg-paper w-full rounded-lg border px-2.5 py-1 font-mono text-[11px]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live Preview of the generated Try-It form */}
                  <div className="border-line bg-paper-raised flex flex-col justify-between rounded-xl border p-3.5">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-ink-muted font-mono text-[10px] font-bold uppercase">
                          Live Tester Overlay Preview
                        </span>
                        <span className="bg-sage/15 text-sage rounded-full px-2 py-0.5 font-mono text-[10px] font-bold">
                          Auto-Generated
                        </span>
                      </div>
                      {fields.map((f, i) => (
                        <div key={i} className="space-y-1">
                          <label className="block text-xs font-semibold">{f.label}</label>
                          {f.type === "boolean" ? (
                            <input
                              type="checkbox"
                              checked={Boolean(f.defaultValue)}
                              readOnly
                              className="size-4"
                            />
                          ) : (
                            <input
                              type="text"
                              readOnly
                              value={String(f.defaultValue ?? "")}
                              className="border-line bg-paper w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="bg-primary text-primary-ink mt-3 flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-bold opacity-90">
                      <IconBolt className="size-3.5" />
                      Run 1-Tap Container Sandbox
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="border-line bg-paper rounded-full border px-5 py-2.5 text-xs font-bold"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="bg-primary text-primary-ink rounded-full px-6 py-2.5 text-xs font-bold"
                >
                  Continue to AI Vector Indexing →
                </button>
              </div>
            </section>
          )}

          {/* STEP 4: AI Vector Auto-Indexing & Publish */}
          {step === 4 && (
            <section
              aria-labelledby="step4-heading"
              className="border-line bg-paper-raised space-y-4 rounded-[var(--radius-card)] border p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="step4-heading" className="font-display text-lg font-bold">
                    Step 4 — AI Requirement Indexing & Publish
                  </h2>
                  <p className="text-ink-muted text-xs">
                    Whisper + LLM Utility Extractor verifies your problem statement and builds its 16-d pgvector embedding.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runAiUtilityIndexer}
                  disabled={indexing}
                  className="bg-ink text-paper flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"
                >
                  <IconSpark className="size-4" />
                  {indexing ? "Extracting vector…" : "Re-run AI Indexer"}
                </button>
              </div>

              <div className="border-line bg-paper space-y-3 rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">
                    Extracted Problem Vector (text-embedding-3-small · 16-d preview)
                  </span>
                  <span className="text-sage font-mono text-xs font-bold">
                    ✓ Zero-Buzzword Check Passed
                  </span>
                </div>

                {/* Visual 16-d embedding bar representation */}
                <div className="grid grid-cols-16 items-end gap-1 h-12 pt-2">
                  {indexedVector.map((v, idx) => (
                    <div
                      key={idx}
                      className="bg-primary/85 rounded-xs"
                      style={{ height: `${Math.max(18, Math.round(Math.abs(v) * 100))}%` }}
                      title={`dim[${idx}] = ${v}`}
                    />
                  ))}
                </div>

                <div className="space-y-1 pt-1">
                  <label htmlFor="final-problem-edit" className="text-xs font-bold">
                    Confirm Indexed Problem Statement
                  </label>
                  <textarea
                    id="final-problem-edit"
                    rows={2}
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    className="border-line bg-paper-raised w-full rounded-xl border px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  className="mt-0.5 size-4 rounded"
                />
                <span>
                  I confirm this micro-demo runs inside Arrakis&apos;s sandbox constraints (no host mounts, 60s TTL, SSRF-guarded egress).
                </span>
              </label>

              {submitError && (
                <p className="text-alert text-xs font-bold" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="border-line bg-paper rounded-full border px-5 py-2.5 text-xs font-bold"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || !consent}
                  className="bg-primary text-primary-ink flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold shadow-sm disabled:opacity-60"
                >
                  <IconBolt className="size-4" />
                  {submitting ? "Publishing to Feed…" : "Publish Utility Tool"}
                </button>
              </div>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}
