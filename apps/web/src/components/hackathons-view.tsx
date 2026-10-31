"use client";

import type { Hackathon, Post } from "@arrakis/contracts";
import Link from "next/link";
import { useState } from "react";
import {
  PlayIcon,
  ShareIcon,
  SparklesIcon,
  TerminalIcon,
  VerifiedIcon,
} from "./icons";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { cn } from "@/lib/utils";

interface HackathonsViewProps {
  hackathons: Hackathon[];
  projectsByHackathon: Record<string, Post[]>;
}

export function HackathonsView({
  hackathons: initialHackathons,
  projectsByHackathon: initialProjects,
}: HackathonsViewProps) {
  const [hackathons, setHackathons] = useState<Hackathon[]>(initialHackathons);
  const [projectsMap, setProjectsMap] =
    useState<Record<string, Post[]>>(initialProjects);
  const [selectedSlug, setSelectedSlug] = useState<string>("all");

  const [activeTryPost, setActiveTryPost] = useState<Post | null>(null);
  const [activeSharePost, setActiveSharePost] = useState<Post | null>(null);

  // Create Hackathon Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [desc, setDesc] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(
    null
  );
  const [copiedLink, setCopiedLink] = useState(false);

  const displayedHackathons =
    selectedSlug === "all"
      ? hackathons
      : hackathons.filter((h) => h.slug === selectedSlug || h.id === selectedSlug);

  async function handleCreateHackathon(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch("/api/hackathons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tag: tag.trim() || undefined,
          organizerName: organizer.trim() || undefined,
          description: desc.trim() || undefined,
          websiteUrl: website.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.hackathon) {
        setModalError(data.error || "Failed to create hackathon space");
        return;
      }
      const created: Hackathon = data.hackathon;
      setHackathons((prev) => [created, ...prev]);
      setProjectsMap((prev) => ({ ...prev, [created.id]: [] }));
      const invite =
        data.inviteUrl ||
        `${window.location.origin}/create?hackathon=${encodeURIComponent(
          created.slug
        )}`;
      setGeneratedInviteUrl(invite);
    } catch {
      setModalError("Network error while creating hackathon");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyInvite() {
    if (!generatedInviteUrl) return;
    navigator.clipboard.writeText(generatedInviteUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2400);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6 lg:py-9 space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-800">
              🏆 Hackathon Showcase
            </span>
            <span className="text-xs text-muted">
              Competitive Sprints & Events
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Projects Arranged by Hackathons
          </h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Explore indie builds shipped during global sprintathons. Test live
            sandboxes directly or generate a dynamic submission link for your
            own hackathon.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setGeneratedInviteUrl(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-dune hover:bg-ink/90 transition-colors shadow-xs"
          >
            <span>+ Create Hackathon Space</span>
          </button>

          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-accent-hover transition-colors shadow-xs"
          >
            <span>Submit a Build</span>
          </Link>
        </div>
      </div>

      {/* Filter Rail */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedSlug("all")}
          className={cn(
            "rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
            selectedSlug === "all"
              ? "bg-ink text-dune shadow-sm"
              : "bg-surface border border-border text-muted hover:text-ink"
          )}
        >
          All Hackathons ({hackathons.length})
        </button>

        {hackathons.map((h) => {
          const active = selectedSlug === h.slug || selectedSlug === h.id;
          const count = projectsMap[h.id]?.length ?? h.projectCount ?? 0;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelectedSlug(h.slug)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5",
                active
                  ? "bg-ink text-dune shadow-sm"
                  : "bg-surface border border-border text-muted hover:text-ink"
              )}
            >
              <span>{h.name}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  active ? "bg-dune/20 text-dune" : "bg-dune text-muted"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hackathons Arranged Sections */}
      <div className="space-y-10">
        {displayedHackathons.map((h) => {
          const projects = projectsMap[h.id] ?? [];
          const inviteUrl = `/create?hackathon=${encodeURIComponent(h.slug)}`;

          return (
            <section
              key={h.id}
              className="rounded-3xl border border-border bg-surface overflow-hidden shadow-xs space-y-5 p-5 sm:p-7"
            >
              {/* Hackathon Header Card */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/70 pb-5">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      🏆 {h.name}
                    </span>
                    <span className="text-xs text-muted">
                      Organized by <strong>{h.organizerName}</strong>
                    </span>
                    <span className="rounded-md bg-dune px-2 py-0.5 font-mono text-[11px] text-muted border border-border">
                      #{h.tag}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-ink/90 leading-relaxed max-w-3xl">
                    {h.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    href={inviteUrl}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors shadow-xs"
                  >
                    <span>Submit to {h.name.split(" ")[0]}</span>
                    <span>→</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      const fullUrl = `${window.location.origin}${inviteUrl}`;
                      navigator.clipboard.writeText(fullUrl).catch(() => {});
                      alert(`Copied submission link for ${h.name}:\n${fullUrl}`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-dune px-3 py-2 text-xs font-semibold text-ink hover:bg-border/40 transition-colors"
                  >
                    <span>🔗 Copy Participant Link</span>
                  </button>
                </div>
              </div>

              {/* Projects Grid for this Hackathon */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
                    Submitted Builds ({projects.length})
                  </h3>
                  <span className="text-xs text-muted">
                    1-Tap proof-of-trial live sandboxes
                  </span>
                </div>

                {projects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-dune/40 p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-ink">
                      No projects submitted to this hackathon yet!
                    </p>
                    <p className="text-xs text-muted">
                      Be the first to ship a live interactive build for {h.name}.
                    </p>
                    <Link
                      href={inviteUrl}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover mt-2"
                    >
                      <span>Submit First Project</span>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((post) => (
                      <article
                        key={post.id}
                        className="rounded-2xl border border-border bg-dune/30 overflow-hidden flex flex-col justify-between p-4 space-y-3 hover:border-ink/30 transition-colors shadow-2xs"
                      >
                        <div className="space-y-2.5">
                          {/* Top Author & Verified info */}
                          <div className="flex items-center justify-between text-xs">
                            <Link
                              href={`/u/${post.author.handle}`}
                              className="flex items-center gap-1.5 font-bold text-ink hover:text-accent transition-colors"
                            >
                              <img
                                src={post.author.avatarUrl}
                                alt={post.author.displayName}
                                className="size-5 rounded-full object-cover"
                              />
                              <span>@{post.author.handle}</span>
                              {post.author.verifiedUtility && (
                                <VerifiedIcon className="size-3 text-sage" />
                              )}
                            </Link>

                            <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink border border-border">
                              {post.category}
                            </span>
                          </div>

                          {/* Video Thumbnail Stage */}
                          <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-ink relative group">
                            <img
                              src={post.thumbUrl}
                              alt={post.title}
                              className="h-full w-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-ink/25">
                              <span className="flex size-10 items-center justify-center rounded-full bg-surface/95 text-ink shadow-sm">
                                <PlayIcon className="size-4 translate-x-0.5" />
                              </span>
                            </div>
                          </div>

                          {/* Project Problem statement */}
                          <div>
                            <span className="inline-block rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-800 mb-1">
                              🏆 Built at {h.name}
                            </span>
                            <Link
                              href={`/p/${post.id}`}
                              className="block font-display text-base font-bold text-ink hover:text-accent transition-colors line-clamp-1"
                            >
                              {post.title}
                            </Link>
                            <p className="text-xs text-muted line-clamp-2 mt-1 leading-relaxed">
                              {post.problemStatement}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                          <button
                            type="button"
                            onClick={() => setActiveTryPost(post)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors shadow-2xs"
                          >
                            <TerminalIcon className="size-3.5" />
                            <span>Try Live Demo</span>
                          </button>

                          <Link
                            href={`/p/${post.id}`}
                            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-dune transition-colors"
                          >
                            ↗ Details
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Create Hackathon Modal Dialog */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-hackathon-space-title"
          className="fixed inset-0 z-modal flex items-center justify-center bg-ink/70 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-[540px] rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <h2
                  id="create-hackathon-space-title"
                  className="font-display text-lg font-bold text-ink"
                >
                  Create Hackathon Space
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-sage-soft/70 border border-sage/40 p-4 space-y-2">
                  <span className="block text-xs font-bold text-sage">
                    ✓ Hackathon Space Created & Active!
                  </span>
                  <p className="text-xs text-ink leading-relaxed">
                    Here is your dynamic submission link. Share this link with
                    your participants:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-ink"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors shrink-0"
                    >
                      {copiedLink ? "✓ Copied!" : "Copy Link"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateModalOpen(false);
                      setGeneratedInviteUrl(null);
                    }}
                    className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-dune hover:bg-ink/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateHackathon} className="space-y-3.5">
                <div className="space-y-1">
                  <label htmlFor="modal-hack-name" className="text-xs font-bold text-ink">
                    Hackathon Name *
                  </label>
                  <input
                    id="modal-hack-name"
                    type="text"
                    required
                    placeholder="e.g. SF AI Agents Hackathon 2026"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!tag) {
                        setTag(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "")
                            .slice(0, 32)
                        );
                      }
                    }}
                    className="w-full rounded-xl border border-border bg-dune/40 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="modal-hack-tag" className="text-xs font-bold text-ink">
                      Project Tag Identifier
                    </label>
                    <input
                      id="modal-hack-tag"
                      type="text"
                      placeholder="e.g. sf-ai-2026"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      className="w-full rounded-xl border border-border bg-dune/40 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="modal-hack-organizer" className="text-xs font-bold text-ink">
                      Organizer / Team
                    </label>
                    <input
                      id="modal-hack-organizer"
                      type="text"
                      placeholder="e.g. Frontier AI Lab"
                      value={organizer}
                      onChange={(e) => setOrganizer(e.target.value)}
                      className="w-full rounded-xl border border-border bg-dune/40 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-hack-desc" className="text-xs font-bold text-ink">
                    Event Description
                  </label>
                  <textarea
                    id="modal-hack-desc"
                    rows={2}
                    placeholder="Theme, prize tracks, or criteria..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    className="w-full rounded-xl border border-border bg-dune/40 px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="modal-hack-web" className="text-xs font-bold text-ink">
                    Website or Registration Link (Optional)
                  </label>
                  <input
                    id="modal-hack-web"
                    type="url"
                    placeholder="https://hackathon.org"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full rounded-xl border border-border bg-dune/40 px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                  />
                </div>

                {modalError && (
                  <p className="text-xs font-semibold text-crimson">{modalError}</p>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="rounded-xl border border-border bg-dune px-4 py-2 text-xs font-semibold text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-xs"
                  >
                    <span>{submitting ? "Creating..." : "Generate Dynamic Link"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <TrySheet post={activeTryPost} onClose={() => setActiveTryPost(null)} />
      <ShareSheet post={activeSharePost} onClose={() => setActiveSharePost(null)} />
    </div>
  );
}
