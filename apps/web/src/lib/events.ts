"use client";

import type { EventType, TelemetryEvent } from "@arrakis/contracts";
import { VIEWER_ID } from "./utils";

const queue: TelemetryEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (queue.length === 0) return;
  const body = JSON.stringify({ events: queue.splice(0, queue.length) });
  // sendBeacon survives page unloads; fall back to keepalive fetch.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const ok = navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    if (ok) return;
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/** Batched, fire-and-forget telemetry (view dwell, try, upvote, share). */
export function track(type: EventType, postId?: string, value?: number, targetUserId?: string) {
  queue.push({ userId: VIEWER_ID, postId, targetUserId, type, value, ts: new Date().toISOString() });
  if (!timer) timer = setTimeout(flush, 2000);
}

export function queueEvent(evt: {
  type: EventType;
  postId?: string;
  value?: number;
  targetUserId?: string;
}) {
  track(evt.type, evt.postId, evt.value, evt.targetUserId);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
