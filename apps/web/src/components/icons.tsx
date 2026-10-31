import type { SVGProps } from "react";

/**
 * Original Arrakis icon set (hand-drawn 24px strokes). Intentionally not the
 * Instagram glyphs. All icons are decorative; callers add aria-labels to buttons.
 */
type P = SVGProps<SVGSVGElement>;

function Base(props: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const IconDune = (p: P) => (
  <Base {...p}>
    <path d="M3 18c3-7 6-9 9-9s6 4 9 9" />
    <path d="M3 21h18" />
    <circle cx="17" cy="6" r="2" />
  </Base>
);
export const IconCompass = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Base>
);
export const IconPlus = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="5" />
    <path d="M12 8.5v7M8.5 12h7" />
  </Base>
);
export const IconTrophy = (p: P) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a2 2 0 0 0 3 3M16 6h3a2 2 0 0 1-3 3" />
    <path d="M12 13v4M9 20h6" />
  </Base>
);
export const IconUser = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);
export const IconBolt = (p: P) => (
  <Base {...p}>
    <path d="M13 3 5 13h6l-1 8 8-10h-6z" />
  </Base>
);
export const IconArrowUp = (p: P) => (
  <Base {...p}>
    <path d="M12 19V6M6 11l6-6 6 6" />
  </Base>
);
export const IconChat = (p: P) => (
  <Base {...p}>
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4 3v-3H6a2 2 0 0 1-2-2z" />
  </Base>
);
export const IconBookmark = (p: P) => (
  <Base {...p}>
    <path d="M7 4h10v16l-5-4-5 4z" />
  </Base>
);
export const IconShare = (p: P) => (
  <Base {...p}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Base>
);
export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);
export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4-4" />
  </Base>
);
export const IconSpark = (p: P) => (
  <Base {...p}>
    <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />
  </Base>
);
export const IconPlay = (p: P) => (
  <Base {...p}>
    <path d="M8 5v14l11-7z" />
  </Base>
);

export const VerifiedIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </Base>
);

export const TerminalIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="m8 9 3 3-3 3M13 15h3" />
  </Base>
);

export const CopyIcon = (p: P) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Base>
);

export const ExternalLinkIcon = (p: P) => (
  <Base {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </Base>
);

export const TrashIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Base>
);

export const UploadCloudIcon = (p: P) => (
  <Base {...p}>
    <path d="M16 16l-4-4-4 4M12 12v9" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </Base>
);

export const HomeIcon = IconDune;
export const CompassIcon = IconCompass;
export const PlusSquareIcon = IconPlus;
export const TrophyIcon = IconTrophy;
export const UserIcon = IconUser;
export const SparklesIcon = IconSpark;
export const ArrowUpIcon = IconArrowUp;
export const BookmarkIcon = IconBookmark;
export const MessageIcon = IconChat;
export const PlayIcon = IconPlay;
export const ShareIcon = IconShare;
export const CheckCircleIcon = IconCheck;
export const CloseIcon = IconClose;
