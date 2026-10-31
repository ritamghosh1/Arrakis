"use client";

import type { Reason } from "@arrakis/contracts";
import Link from "next/link";
import { IconBolt, IconSpark, IconUser } from "./icons";
import { cn } from "@/lib/utils";

function formatCleanReasonText(reason: Reason): string {
  if (reason.kind === "followed" && reason.via) {
    return `Recommended via @${reason.via.handle}`;
  }
  if (reason.kind === "coldstart") {
    return "Fresh Builder Spotlight";
  }
  if (reason.kind === "taste") {
    return reason.matchedTopic
      ? `Matches your interest in ${reason.matchedTopic}`
      : "Recommended for your interests";
  }
  if (reason.kind === "search") {
    return reason.matchedTopic ? `Solves "${reason.matchedTopic}"` : "Relevant build";
  }
  return "Community Pick";
}

export function ReasonChip({ reason, className }: { reason: Reason; className?: string }) {
  const Icon =
    reason.kind === "followed" ? IconUser : reason.kind === "coldstart" ? IconSpark : IconBolt;
  const cleanText = formatCleanReasonText(reason);

  const body = (
    <>
      <Icon className="size-3.5 shrink-0 text-accent" />
      <span className="truncate text-xs font-medium text-ink">{cleanText}</span>
    </>
  );

  const base = cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-dune/80 px-2.5 py-1",
    className
  );

  if (reason.via) {
    return (
      <Link
        href={`/u/${reason.via.handle}`}
        className={cn(base, "hover:border-ink/40 transition-colors")}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
