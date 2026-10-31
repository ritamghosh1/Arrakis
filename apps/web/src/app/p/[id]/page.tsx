import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SEED_POSTS } from "@arrakis/contracts";
import { MODE_LABEL } from "@/components/reel-card";
import { compact } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = SEED_POSTS.find((p) => p.id === id);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.problemStatement,
    openGraph: { title: post.title, description: post.problemStatement, images: [post.thumbUrl], type: "website" },
    twitter: { card: "summary_large_image", title: post.title, description: post.problemStatement, images: [post.thumbUrl] },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = SEED_POSTS.find((p) => p.id === id);
  if (!post) notFound();

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto flex max-w-xl flex-col gap-4 p-4">
        <Link href="/" className="text-ink-muted text-sm underline">
          Back to feed
        </Link>
        <p className="text-ink-muted text-xs font-medium">{MODE_LABEL[post.demo.mode]}</p>
        <h1 className="font-display text-2xl leading-7 font-bold text-balance">{post.title}</h1>
        <p className="text-pretty">{post.problemStatement}</p>
        <dl className="border-line bg-paper-raised grid grid-cols-3 gap-2 rounded-[var(--radius-card)] border p-3 text-center tabular-nums">
          <div>
            <dt className="text-ink-muted text-xs">Tries</dt>
            <dd className="font-bold">{compact(post.stats.tries)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted text-xs">Uptime</dt>
            <dd className="text-sage font-bold">{post.health.uptimePct}%</dd>
          </div>
          <div>
            <dt className="text-ink-muted text-xs">p95 latency</dt>
            <dd className="font-bold">{post.health.p95LatencyMs}ms</dd>
          </div>
        </dl>
        <section id="comments" aria-label="Comments">
          <h2 className="font-display text-lg font-bold">Feedback</h2>
          <p className="text-ink-muted mt-1 text-sm">{compact(post.stats.comments)} comments. Threads arrive in a later milestone.</p>
        </section>
      </article>
    </div>
  );
}
