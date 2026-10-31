import { HomeFeed } from "@/components/home-feed";
import { fetchHomeFeed, getFreshBuilds } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  const initial = await fetchHomeFeed(viewer, "for_you");
  return <HomeFeed initial={initial} freshBuilds={getFreshBuilds()} />;
}
