import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arrakis — Utility-First Social Feed for Indie Projects",
    short_name: "Arrakis",
    description:
      "Discover indie and student projects by the problem they solve, try them in one tap inside an isolated sandbox, and earn Scout XP.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF4EA",
    theme_color: "#FAF4EA",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
