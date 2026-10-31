"use client";

import type { Post } from "@arrakis/contracts";
import { TrySheet } from "./try-sheet";

export function SandboxWrapper(props: {
  post: Post | null;
  onClose: () => void;
  onVerifiedTrial?: (postId: string, xpAwarded: number) => void;
}) {
  return <TrySheet {...props} />;
}

export default SandboxWrapper;
