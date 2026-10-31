import { SEED_USERS } from "@arrakis/contracts";
import { HomeFeed } from "@/components/home-feed";
import { fetchFreshBuilds, fetchHomeFeed } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  const [initial, freshPosts] = await Promise.all([
    fetchHomeFeed(viewer, "for_you"),
    fetchFreshBuilds(10),
  ]);
  const suggestedUsers = SEED_USERS.filter((u) => u.id !== viewer).slice(0, 6);
  return (
    <HomeFeed
      initialItems={initial.items}
      freshPosts={freshPosts}
      suggestedUsers={suggestedUsers}
    />
  );
}
