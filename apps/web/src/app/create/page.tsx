import { Suspense } from "react";
import { CreatePostForm } from "@/components/create-post-form";

export const metadata = { title: "Publish Tool · Arrakis" };

export default function CreatePage() {
  return (
    <div className="w-full">
      <h1 className="sr-only">Publish a Build · Interactive Builder Studio</h1>
      <Suspense
        fallback={
          <div className="mx-auto max-w-[780px] px-4 sm:px-6 py-12 text-center text-sm text-muted space-y-2">
            <h2 className="font-display text-xl font-bold text-ink">Publish a Build</h2>
            <p className="text-xs text-muted">Loading builder form...</p>
          </div>
        }
      >
        <CreatePostForm />
      </Suspense>
    </div>
  );
}
