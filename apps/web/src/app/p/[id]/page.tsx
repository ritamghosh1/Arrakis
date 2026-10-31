import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifiedIcon } from "@/components/icons";
import { PostDetailClient } from "@/components/post-detail-client";
import { getLivePost } from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getLivePost(id);
  if (!post) return { title: "Build Not Found" };
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
    <div className="mx-auto max-w-[1040px] px-4 sm:px-6 py-6 lg:py-9">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            ← Back to Feed
          </Link>
          <span className="rounded-lg border border-border bg-surface px-3 py-1 text-xs font-semibold text-ink">
            {post.category}
          </span>
        </div>

        <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/u/${post.author.handle}`} className="flex items-center gap-3 group">
              <img
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                className="size-10 rounded-full border border-border bg-dune object-cover"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-ink group-hover:text-accent transition-colors">
                    {post.author.displayName}
                  </span>
                  {post.author.verifiedUtility && (
                    <VerifiedIcon className="size-4 text-sage shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted">@{post.author.handle}</p>
              </div>
            </Link>

            {post.health.verifiedUtility && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sage-soft px-3 py-1 text-xs font-semibold text-sage">
                <span className="size-1.5 rounded-full bg-sage" />
                Verified Demo
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink text-balance">
              {post.title}
            </h1>
            <div className="rounded-xl border border-border bg-dune/70 p-4">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-accent mb-1">
                Problem Solved
              </span>
              <p className="text-sm sm:text-[15px] font-medium text-ink leading-relaxed">
                {post.problemStatement}
              </p>
            </div>
          </div>

          <PostDetailClient post={post} />
        </header>
      </article>
    </div>
  );
}
