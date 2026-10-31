import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLivePost } from "@/lib/data";
import { MODE_LABEL } from "@/components/reel-card";
import { PostDetailClient } from "@/components/post-detail-client";
import { compact } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getLivePost(id);
  if (!post) return { title: "Tool Not Found" };
  const canonical = `https://arrakis.dev/p/${post.id}`;
  return {
    title: post.title,
    description: post.problemStatement,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.problemStatement,
      url: canonical,
      images: [post.thumbUrl],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.problemStatement,
      images: [post.thumbUrl],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await getLivePost(id);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: post.title,
    applicationCategory: post.category,
    operatingSystem: "Web / Container Sandbox",
    description: post.problemStatement,
    author: {
      "@type": "Person",
      name: post.author.displayName,
      url: `https://arrakis.dev/u/${post.author.handle}`,
    },
  };

  return (
    <div className="h-full overflow-y-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5 pb-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-ink-muted font-mono text-xs font-semibold underline">
            ← Back to Utility Feed
          </Link>
          <span className="bg-paper-sunken text-ink rounded-full px-3 py-1 font-mono text-xs font-semibold">
            {MODE_LABEL[post.demo.mode]} · {post.demo.target}
          </span>
        </div>

        <header className="border-line bg-paper-raised space-y-3 rounded-[var(--radius-card)] border p-5">
          <div className="flex items-center justify-between">
            <Link href={`/u/${post.author.handle}`} className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.author.avatarUrl}
                alt=""
                width={36}
                height={36}
                className="bg-paper-sunken size-9 rounded-full"
              />
              <div>
                <p className="text-sm font-bold">{post.author.displayName}</p>
                <p className="text-ink-muted font-mono text-xs">@{post.author.handle}</p>
              </div>
            </Link>
            <span className="text-sage font-mono text-xs font-bold">
              ● {post.health.uptimePct}% Live Uptime
            </span>
          </div>

          <h1 className="font-display text-2xl leading-7 font-bold text-balance">{post.title}</h1>
          <p className="text-ink-muted text-sm leading-relaxed text-pretty">
            <strong className="text-ink">Problem solved: </strong>
            {post.problemStatement}
          </p>

          {/* Auto Scalability Health Card */}
          <dl className="border-line bg-paper grid grid-cols-2 gap-2 rounded-2xl border p-3 text-center font-mono text-xs tabular-nums sm:grid-cols-5">
            <div>
              <dt className="text-ink-muted text-[10px] uppercase">Sandbox Tries</dt>
              <dd className="mt-0.5 text-sm font-bold">{compact(post.stats.tries)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted text-[10px] uppercase">3× Trial Votes</dt>
              <dd className="text-sage mt-0.5 text-sm font-bold">{post.stats.trialUpvotes}</dd>
            </div>
            <div>
              <dt className="text-ink-muted text-[10px] uppercase">p50 Latency</dt>
              <dd className="mt-0.5 text-sm font-bold">{post.health.p50LatencyMs}ms</dd>
            </div>
            <div>
              <dt className="text-ink-muted text-[10px] uppercase">p95 Latency</dt>
              <dd className="mt-0.5 text-sm font-bold">{post.health.p95LatencyMs}ms</dd>
            </div>
            <div>
              <dt className="text-ink-muted text-[10px] uppercase">Trial Score</dt>
              <dd className="mt-0.5 text-sm font-bold">{post.postScore}</dd>
            </div>
          </dl>

          <PostDetailClient post={post} />
        </header>
      </article>
    </div>
  );
}
