"use client";

import type { DemoMode, FormFieldSchema, Post } from "@arrakis/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  PlayIcon,
  PlusSquareIcon,
  ShareIcon,
  SparklesIcon,
  TerminalIcon,
  TrashIcon,
  UploadCloudIcon,
} from "./icons";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { CATEGORIES } from "@/lib/categories";
import {
  cn,
  extractYouTubeId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
} from "@/lib/utils";

const SAMPLE_VIDEOS = [
  {
    label: "Terminal CLI Demo",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=900&auto=format&fit=crop&q=80",
    durationSec: 45,
  },
  {
    label: "API Workflow Demo",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80",
    durationSec: 52,
  },
] as const;

const SAMPLE_YOUTUBE_LINKS = [
  {
    label: "Sample YouTube Build Pitch",
    url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  },
] as const;

const DRAFT_STORAGE_KEY = "arrakis_create_post_draft_v2";

export function CreatePostForm() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Pitch Reel (YouTube link, Upload file, or Sample video)
  const [videoSourceMode, setVideoSourceMode] = useState<"youtube" | "upload" | "sample">("youtube");
  const [youtubeInput, setYoutubeInput] = useState("https://www.youtube.com/watch?v=M7lc1UVf-VE");
  const [videoUrl, setVideoUrl] = useState<string>("https://www.youtube.com/watch?v=M7lc1UVf-VE");
  const [thumbUrl, setThumbUrl] = useState<string>(
    "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg"
  );
  const [durationSec, setDurationSec] = useState<number>(60);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Step 2: Problem & Basics
  const [title, setTitle] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [tagsInput, setTagsInput] = useState("cli, automation, devtools");

  // Step 3: Live Demo Wiring & Auto-Form Builder
  const [demoMode, setDemoMode] = useState<DemoMode>("container");
  const [demoTarget, setDemoTarget] = useState("ghcr.io/ritamghosh1/arrakis-demo:latest");
  const [repoUrl, setRepoUrl] = useState("https://github.com/ritamghosh1/Arrakis");
  const [sampleCommand, setSampleCommand] = useState("run-tool --format json");
  const [formSchema, setFormSchema] = useState<FormFieldSchema[]>([
    {
      name: "input_text",
      label: "Input Text or Payload",
      type: "text",
      required: true,
      placeholder: "Paste sample input...",
      defaultValue: "Sample project input for live test",
    },
    {
      name: "output_mode",
      label: "Output Format",
      type: "select",
      required: true,
      options: ["json", "markdown", "summary"],
      defaultValue: "json",
    },
  ]);

  // Step 4: Review & Publish
  const [publishing, setPublishing] = useState(false);
  const [publishedPost, setPublishedPost] = useState<Post | null>(null);
  const [activeTryPost, setActiveTryPost] = useState<Post | null>(null);
  const [activeSharePost, setActiveSharePost] = useState<Post | null>(null);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);

  // Restore saved draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.title) setTitle(draft.title);
      if (draft.problemStatement) setProblemStatement(draft.problemStatement);
      if (draft.category) setCategory(draft.category);
      if (draft.tagsInput) setTagsInput(draft.tagsInput);
      if (draft.demoMode) setDemoMode(draft.demoMode);
      if (draft.demoTarget) setDemoTarget(draft.demoTarget);
      if (draft.youtubeInput) {
        setYoutubeInput(draft.youtubeInput);
        const ytId = extractYouTubeId(draft.youtubeInput);
        if (ytId) {
          setVideoSourceMode("youtube");
          setVideoUrl(draft.youtubeInput);
          setThumbUrl(`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`);
        }
      }
    } catch {
      // Ignore draft parse error
    }
  }, []);

  function handleSaveDraft() {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          title,
          problemStatement,
          category,
          tagsInput,
          demoMode,
          demoTarget,
          youtubeInput,
        })
      );
      setDraftSavedNotice(true);
      setTimeout(() => setDraftSavedNotice(false), 2400);
    } catch {
      // Ignore storage error
    }
  }

  function handleYouTubeUrlChange(nextUrl: string) {
    setYoutubeInput(nextUrl);
    setVideoError(null);
    const ytId = extractYouTubeId(nextUrl);
    if (ytId) {
      setVideoUrl(nextUrl.trim());
      setThumbUrl(
        getYouTubeThumbnailUrl(nextUrl) ?? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
      );
      setUploadedFileName(null);
    } else if (nextUrl.trim().length > 0) {
      setVideoError("Please enter a valid YouTube link (youtube.com/watch?v=... or youtu.be/...)");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError(null);

    if (!file.type.startsWith("video/")) {
      setVideoError("Please select an MP4 or WebM video file.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const sec = Math.round(probe.duration || 45);
      if (sec > 120) {
        setVideoError("Pitch videos should be under 2 minutes.");
      } else {
        setDurationSec(sec);
        setVideoUrl(objectUrl);
        setUploadedFileName(file.name);
      }
    };
    probe.src = objectUrl;
  }

  function handleAddField() {
    const idx = formSchema.length + 1;
    setFormSchema((prev) => [
      ...prev,
      {
        name: `param_${idx}`,
        label: `Input Parameter ${idx}`,
        type: "text",
        required: false,
        placeholder: "Enter value...",
        defaultValue: "",
      },
    ]);
  }

  function handleUpdateField(index: number, patch: Partial<FormFieldSchema>) {
    setFormSchema((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function handleRemoveField(index: number) {
    setFormSchema((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (publishing) return;

    setPublishing(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
        .filter(Boolean);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorId: "usr_ritam",
          title: title.trim() || "Untitled Build",
          problemStatement:
            problemStatement.trim() ||
            "Helps developers automate repetitive workflows directly from the browser.",
          category,
          videoUrl,
          thumbUrl,
          durationSec,
          demo: {
            mode: demoMode,
            target: demoTarget.trim() || "ghcr.io/ritamghosh1/arrakis-demo:latest",
            repoUrl: repoUrl.trim() || undefined,
            sampleCommand: sampleCommand.trim() || undefined,
            formSchema,
          },
          tags: tags.length > 0 ? tags : ["devtools", "utility"],
        }),
      });

      const data = await res.json();
      if (data.post) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setPublishedPost(data.post);
      }
    } finally {
      setPublishing(false);
    }
  }

  const ytEmbedUrl = getYouTubeEmbedUrl(videoUrl);

  if (publishedPost) {
    return (
      <div className="mx-auto max-w-[780px] px-4 sm:px-6 py-10 space-y-6">
        <div className="rounded-2xl border border-sage/40 bg-surface p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-3.5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-sage-soft text-sage shrink-0">
              <CheckCircleIcon className="size-6" />
            </span>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-sage">
                Published Live
              </span>
              <h1 className="font-display text-2xl font-bold text-ink">{publishedPost.title}</h1>
              <p className="text-sm text-muted">
                Your build and interactive demo are now live on Arrakis.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-dune/70 p-4 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Problem Statement
            </span>
            <p className="text-sm font-medium text-ink">{publishedPost.problemStatement}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveTryPost(publishedPost)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              <TerminalIcon className="size-4" />
              <span>Test Live Demo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSharePost(publishedPost)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-dune px-4 py-2.5 text-sm font-semibold text-ink hover:bg-border/40 transition-colors"
            >
              <ShareIcon className="size-4" />
              <span>Share Build</span>
            </button>

            <Link
              href={`/p/${publishedPost.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-dune transition-colors"
            >
              <span>Open Post Page →</span>
            </Link>
          </div>
        </div>

        <TrySheet post={activeTryPost} onClose={() => setActiveTryPost(null)} />
        <ShareSheet post={activeSharePost} onClose={() => setActiveSharePost(null)} />
      </div>
    );
  }

  const STEPS = [
    { num: 1, title: "Pitch Video" },
    { num: 2, title: "Problem & Info" },
    { num: 3, title: "Live Demo Setup" },
    { num: 4, title: "Review & Publish" },
  ] as const;

  return (
    <div className="mx-auto max-w-[920px] px-4 sm:px-6 py-6 lg:py-9 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Publish a Build
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Share a short pitch video or YouTube link paired with a live interactive demo.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          className="rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-ink hover:bg-dune transition-colors"
        >
          {draftSavedNotice ? "✓ Draft Saved" : "Save Draft"}
        </button>
      </div>

      {/* Stepper Bar */}
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {STEPS.map((s) => {
          const active = step === s.num;
          const completed = step > s.num;
          return (
            <li key={s.num}>
              <button
                type="button"
                onClick={() => setStep(s.num)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                  active
                    ? "border-ink bg-ink text-dune shadow-sm"
                    : completed
                    ? "border-sage/40 bg-sage-soft/50 text-ink"
                    : "border-border bg-surface text-muted hover:text-ink"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-bold shrink-0",
                    active
                      ? "bg-accent text-white"
                      : completed
                      ? "bg-sage text-white"
                      : "bg-dune text-muted"
                  )}
                >
                  {completed ? "✓" : s.num}
                </span>
                <span className="text-xs font-semibold truncate">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Main Step Card */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
        {/* STEP 1: PITCH VIDEO OR YOUTUBE LINK */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  Step 1 · Add Your Pitch Video
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Paste a YouTube link, upload an MP4/WebM video file, or pick a sample demo video.
                </p>
              </div>

              {/* Source Mode Selector */}
              <div className="inline-flex rounded-xl border border-border bg-dune p-1">
                <button
                  type="button"
                  onClick={() => {
                    setVideoSourceMode("youtube");
                    if (youtubeInput) handleYouTubeUrlChange(youtubeInput);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    videoSourceMode === "youtube"
                      ? "bg-ink text-dune shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  YouTube Link
                </button>
                <button
                  type="button"
                  onClick={() => setVideoSourceMode("upload")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    videoSourceMode === "upload"
                      ? "bg-ink text-dune shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  Upload Video
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVideoSourceMode("sample");
                    setVideoUrl(SAMPLE_VIDEOS[0].videoUrl);
                    setThumbUrl(SAMPLE_VIDEOS[0].thumbUrl);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    videoSourceMode === "sample"
                      ? "bg-ink text-dune shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  Sample Reel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Input Panel */}
              <div className="lg:col-span-6 space-y-4">
                {videoSourceMode === "youtube" && (
                  <div className="rounded-2xl border border-border bg-dune/50 p-5 space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="youtube-url-input"
                        className="block text-xs font-bold uppercase tracking-wider text-ink"
                      >
                        YouTube Video or Shorts Link
                      </label>
                      <input
                        id="youtube-url-input"
                        type="url"
                        inputMode="url"
                        placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                        value={youtubeInput}
                        onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                      />
                      <p className="text-xs text-muted">
                        Supports standard YouTube watch URLs, shortened{" "}
                        <code className="font-mono text-[11px]">youtu.be</code> links, and YouTube
                        Shorts.
                      </p>
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="block text-xs font-semibold text-muted">
                        Quick example link:
                      </span>
                      {SAMPLE_YOUTUBE_LINKS.map((item) => (
                        <button
                          key={item.url}
                          type="button"
                          onClick={() => handleYouTubeUrlChange(item.url)}
                          className="w-full flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-ink hover:border-ink/40 transition-colors"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <PlayIcon className="size-3.5 text-accent shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="text-accent font-semibold shrink-0">Use Link</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {videoSourceMode === "upload" && (
                  <label
                    htmlFor="pitch-video-file"
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-dune/50 p-8 text-center cursor-pointer hover:border-accent transition-colors"
                  >
                    <UploadCloudIcon className="size-9 text-accent mb-2.5" />
                    <span className="text-sm font-semibold text-ink">
                      {uploadedFileName ? uploadedFileName : "Click to select an MP4 or WebM file"}
                    </span>
                    <span className="text-xs text-muted mt-1">
                      Short demo showing the problem and your working solution
                    </span>
                    <input
                      id="pitch-video-file"
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                )}

                {videoSourceMode === "sample" && (
                  <div className="space-y-2.5">
                    <span className="block text-xs font-semibold text-muted">
                      Choose a sample pitch video:
                    </span>
                    {SAMPLE_VIDEOS.map((sample) => (
                      <button
                        key={sample.videoUrl}
                        type="button"
                        onClick={() => {
                          setVideoUrl(sample.videoUrl);
                          setThumbUrl(sample.thumbUrl);
                          setDurationSec(sample.durationSec);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-colors",
                          videoUrl === sample.videoUrl
                            ? "border-ink bg-dune font-semibold text-ink"
                            : "border-border bg-surface text-muted hover:text-ink"
                        )}
                      >
                        <span className="flex items-center gap-2.5 text-sm">
                          <PlayIcon className="size-4 text-accent" />
                          <span>{sample.label}</span>
                        </span>
                        <span className="text-xs text-muted">Select</span>
                      </button>
                    ))}
                  </div>
                )}

                {videoError && (
                  <p role="alert" className="rounded-xl bg-crimson/10 px-3.5 py-2.5 text-xs font-semibold text-crimson">
                    {videoError}
                  </p>
                )}
              </div>

              {/* Right Live Video / YouTube Preview */}
              <div className="lg:col-span-6 space-y-2">
                <span className="block text-xs font-semibold text-muted">Live Player Preview</span>
                <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-ink border border-border">
                  {ytEmbedUrl ? (
                    <iframe
                      title="YouTube pitch preview"
                      src={ytEmbedUrl}
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      key={videoUrl}
                      src={videoUrl}
                      poster={thumbUrl}
                      controls
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-dune hover:bg-ink/90 transition-colors"
              >
                Continue to Problem & Info →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PROBLEM STATEMENT & BASICS */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Step 2 · Problem Statement & Project Info
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Describe the exact problem your build solves in plain language.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="post-title" className="block text-xs font-bold text-ink">
                  Project Title
                </label>
                <input
                  id="post-title"
                  type="text"
                  required
                  placeholder="e.g., ResumeJSON — Instant ATS Parser & Validator"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="post-problem" className="block text-xs font-bold text-ink">
                  What specific problem does it solve?
                </label>
                <textarea
                  id="post-problem"
                  rows={3}
                  required
                  placeholder="e.g., Converts messy multi-column PDF resumes into clean, validated JSON schemas in one click without losing work history."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="post-category" className="block text-xs font-bold text-ink">
                    Category
                  </label>
                  <select
                    id="post-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="post-tags" className="block text-xs font-bold text-ink">
                    Tags (comma-separated)
                  </label>
                  <input
                    id="post-tags"
                    type="text"
                    placeholder="cli, rust, parser, productivity"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-border bg-dune px-4 py-2.5 text-xs font-semibold text-ink"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-dune hover:bg-ink/90 transition-colors"
              >
                Continue to Live Demo Setup →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LIVE DEMO WIRING & INTERACTIVE INPUT BUILDER */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Step 3 · Configure the Try-It Live Demo
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Let viewers test your project right inside the feed without installing anything.
              </p>
            </div>

            {/* Mode Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  { id: "container", label: "Container / CLI", desc: "Docker image" },
                  { id: "api", label: "API Endpoint", desc: "HTTP JSON endpoint" },
                  { id: "web", label: "Web App", desc: "Interactive web preview" },
                  { id: "handoff", label: "Desktop App", desc: "Send link to laptop" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDemoMode(m.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    demoMode === m.id
                      ? "border-ink bg-ink text-dune"
                      : "border-border bg-dune/50 text-ink hover:border-ink/40"
                  )}
                >
                  <span className="block text-xs font-bold">{m.label}</span>
                  <span
                    className={cn(
                      "block text-[11px] mt-0.5",
                      demoMode === m.id ? "text-dune/75" : "text-muted"
                    )}
                  >
                    {m.desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="demo-target" className="block text-xs font-bold text-ink">
                  {demoMode === "container"
                    ? "Container Image"
                    : demoMode === "api"
                    ? "API Endpoint URL"
                    : "Web / Project URL"}
                </label>
                <input
                  id="demo-target"
                  type="text"
                  value={demoTarget}
                  onChange={(e) => setDemoTarget(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="demo-repo" className="block text-xs font-bold text-ink">
                  GitHub Repository (optional)
                </label>
                <input
                  id="demo-repo"
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Zero-Code Input Builder */}
            <div className="rounded-2xl border border-border bg-dune/50 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-ink">
                    Interactive Demo Inputs
                  </h3>
                  <p className="text-xs text-muted">
                    Fields shown to users when they click &ldquo;Try Live Demo&rdquo;
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-dune"
                >
                  <PlusSquareIcon className="size-3.5" />
                  <span>Add Field</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {formSchema.map((field, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-border bg-surface p-3"
                  >
                    <input
                      type="text"
                      aria-label="Field label"
                      placeholder="Field label"
                      value={field.label}
                      onChange={(e) =>
                        handleUpdateField(idx, {
                          label: e.target.value,
                          name: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "_")
                            .replace(/^_|_$/g, ""),
                        })
                      }
                      className="sm:col-span-4 rounded-lg border border-border bg-dune/40 px-2.5 py-1.5 text-xs text-ink"
                    />
                    <select
                      aria-label="Field type"
                      value={field.type}
                      onChange={(e) =>
                        handleUpdateField(idx, {
                          type: e.target.value as FormFieldSchema["type"],
                        })
                      }
                      className="sm:col-span-3 rounded-lg border border-border bg-dune/40 px-2.5 py-1.5 text-xs text-ink"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="url">URL</option>
                      <option value="json">JSON</option>
                      <option value="select">Dropdown</option>
                    </select>
                    <input
                      type="text"
                      aria-label="Default sample value"
                      placeholder="Default sample value..."
                      value={String(field.defaultValue ?? "")}
                      onChange={(e) => handleUpdateField(idx, { defaultValue: e.target.value })}
                      className="sm:col-span-4 rounded-lg border border-border bg-dune/40 px-2.5 py-1.5 text-xs text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      aria-label={`Remove ${field.label}`}
                      className="sm:col-span-1 flex items-center justify-center rounded-lg p-1.5 text-muted hover:text-crimson"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl border border-border bg-dune px-4 py-2.5 text-xs font-semibold text-ink"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-dune hover:bg-ink/90 transition-colors"
              >
                Review & Publish →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CLEAN REVIEW & PUBLISH */}
        {step === 4 && (
          <form onSubmit={handlePublish} className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Step 4 · Review & Publish
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Confirm how your project card will appear in the feed.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Video / YouTube Preview */}
              <div className="lg:col-span-5 rounded-2xl border border-border bg-ink overflow-hidden aspect-[16/10]">
                {ytEmbedUrl ? (
                  <iframe
                    title="YouTube preview"
                    src={ytEmbedUrl}
                    className="h-full w-full border-0"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={videoUrl}
                    poster={thumbUrl}
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              {/* Clean Summary Details */}
              <div className="lg:col-span-7 rounded-2xl border border-border bg-dune/60 p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink border border-border">
                    {category}
                  </span>
                  <span className="rounded-md bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent capitalize">
                    {demoMode} Demo
                  </span>
                  {extractYouTubeId(videoUrl) && (
                    <span className="rounded-md bg-sage-soft px-2.5 py-0.5 text-xs font-semibold text-sage">
                      YouTube Pitch Linked
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-display text-xl font-bold text-ink">
                    {title.trim() || "Untitled Build"}
                  </h3>
                  <p className="text-sm text-muted mt-1">
                    {problemStatement.trim() ||
                      "Helps developers automate repetitive workflows directly from the browser."}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs text-muted">
                  <span>Interactive Demo Fields: {formSchema.length}</span>
                  <span>Ready for instant community testing</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-xl border border-border bg-dune px-4 py-2.5 text-xs font-semibold text-ink"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={publishing}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60 transition-colors shadow-sm"
              >
                <SparklesIcon className="size-4" />
                <span>{publishing ? "Publishing..." : "Publish Build Now"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
