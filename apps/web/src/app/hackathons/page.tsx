import type { Metadata } from "next";
import type { Post } from "@arrakis/contracts";
import { HackathonsView } from "@/components/hackathons-view";
import { fetchHackathons, fetchHackathonProjects } from "@/lib/data";

export const metadata: Metadata = {
  title: "Hackathon Showcase · Arrakis",
  description:
    "Explore indie tools and utility apps built during competitive hackathons and sprintathons. Try live sandboxes directly in your browser.",
};

export const dynamic = "force-dynamic";

export default async function HackathonsPage() {
  const hackathons = await fetchHackathons();
  const projectsByHackathon: Record<string, Post[]> = {};

  await Promise.all(
    hackathons.map(async (h) => {
      try {
        const list = await fetchHackathonProjects(h.id);
        projectsByHackathon[h.id] = list;
      } catch {
        projectsByHackathon[h.id] = [];
      }
    })
  );

  return (
    <HackathonsView
      hackathons={hackathons}
      projectsByHackathon={projectsByHackathon}
    />
  );
}
