import { Suspense } from "react";
import { CreatePostForm } from "@/components/create-post-form";

export const metadata = { title: "Publish Tool · Arrakis" };

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[780px] px-4 sm:px-6 py-12 text-center text-sm text-muted">
          Loading builder form...
        </div>
      }
    >
      <CreatePostForm />
    </Suspense>
  );
}
