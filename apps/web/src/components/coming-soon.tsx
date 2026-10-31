import Link from "next/link";

export function ComingSoon({ title, blurb, cta }: { title: string; blurb: string; cta: { href: string; label: string } }) {
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl font-bold text-balance">{title}</h1>
        <p className="text-ink-muted mt-2 text-pretty">{blurb}</p>
        <Link href={cta.href} className="bg-primary text-primary-ink mt-5 inline-block rounded-full px-5 py-2.5 font-semibold">
          {cta.label}
        </Link>
      </div>
    </div>
  );
}
