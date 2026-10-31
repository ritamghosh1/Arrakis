import { SEED_USERS } from "@arrakis/contracts";
import { HomeFeed } from "@/components/home-feed";
import { fetchHomeFeed, getFreshBuilds } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  const initial = await fetchHomeFeed(viewer, "for_you");
  const suggestedUsers = SEED_USERS.filter((u) => u.id !== viewer).slice(0, 6);
  return (
    <HomeFeed
      initialItems={initial.items}
      freshPosts={getFreshBuilds()}
      suggestedUsers={suggestedUsers}
    />
  );
}
