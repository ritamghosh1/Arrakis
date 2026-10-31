"use client";

import Link from "next/link";
import type { Reason } from "@arrakis/contracts";
import { cn } from "@/lib/utils";
import { IconBolt, IconSpark, IconUser } from "./icons";

const KIND_LABEL: Record<Reason["kind"], string> = {
  followed: "From your circle",
  taste: "Matches your taste",
  coldstart: "Fresh builder",
  trending: "Proof-of-Trial pick",
  search: "Problem match",
};

/** Always-visible explanation of why a post is in the feed (flagship attribution UI). */
export function ReasonChip({ reason, className }: { reason: Reason; className?: string }) {
  const Icon = reason.kind === "followed" ? IconUser : reason.kind === "coldstart" ? IconSpark : IconBolt;
  const body = (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0">
        <span className="sr-only">{KIND_LABEL[reason.kind]}: </span>
        <span className="line-clamp-2 text-[12px] leading-4 font-medium text-pretty">{reason.text}</span>
      </span>
    </>
  );
  const base = cn(
    "bg-paper-raised/95 text-ink flex max-w-[16rem] items-start gap-1.5 rounded-2xl px-3 py-1.5 shadow-sm",
    className,
  );
  if (reason.via) {
    return (
      <Link href={`/u/${reason.via.handle}`} className={cn(base, "hover:bg-paper-raised")}>
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
