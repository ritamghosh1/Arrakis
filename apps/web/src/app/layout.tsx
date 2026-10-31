import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Arrakis — try indie tools in one tap", template: "%s · Arrakis" },
  description:
    "A utility-first feed for indie and student projects. Discover tools by the problem they solve, try them instantly, and earn for real feedback.",
  applicationName: "Arrakis",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF4EA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={bricolage.variable}>
      <body>
        <a
          href="#main"
          className="sr-only-focusable bg-ink text-paper z-toast fixed top-2 left-2 rounded-full px-4 py-2 text-sm"
        >
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
