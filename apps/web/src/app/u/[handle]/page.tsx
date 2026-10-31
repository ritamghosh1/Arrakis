import type { Metadata } from "next";
import { ProfileView } from "@/components/profile-view";
import { fetchProfile, getFollowersForUser, getFollowingForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await fetchProfile(handle);
  return {
    title: `${profile.user.displayName} (@${profile.user.handle})`,
    description: `${profile.user.bio} · ${profile.user.followersCount} followers · Builder Score ${profile.user.builderScore}`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const viewerId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  const profile = await fetchProfile(handle, viewerId);
  const followersList = getFollowersForUser(profile.user.id);
  const followingList = getFollowingForUser(profile.user.id);

  return (
    <ProfileView
      profile={profile}
      followersList={followersList}
      followingList={followingList}
    />
  );
}
