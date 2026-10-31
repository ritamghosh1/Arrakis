import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Ranks" };

export default function RanksPage() {
  return (
    <ComingSoon
      title="Leaderboard"
      blurb="Builders, Scouts and trending projects ranked by Proof-of-Trial score land in the scoring milestone."
      cta={{ href: "/explore", label: "Explore tools to try" }}
    />
  );
}
