import { LeaderboardView } from "@/components/leaderboard-view";
import { fetchLeaderboard } from "@/lib/data";

export const metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function RanksPage() {
  const viewerId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  const initial = await fetchLeaderboard("builders", "7d", viewerId);
  return <LeaderboardView initial={initial} />;
}
