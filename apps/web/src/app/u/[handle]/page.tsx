import { ComingSoon } from "@/components/coming-soon";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return (
    <ComingSoon
      title={`@${handle}`}
      blurb="Profiles with follow counts, a project shelf and badges arrive in the profile milestone."
      cta={{ href: "/", label: "Back to Home" }}
    />
  );
}
