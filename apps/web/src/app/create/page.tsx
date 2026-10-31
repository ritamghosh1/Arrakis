import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <ComingSoon
      title="Post a demo"
      blurb="The four-step upload form (pitch video, problem statement, demo wiring, publish) is the next milestone."
      cta={{ href: "/", label: "Back to Home" }}
    />
  );
}
