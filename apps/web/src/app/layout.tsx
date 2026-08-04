import type { Metadata } from "next";
import "@repo/config/tailwind/theme.css";

export const metadata: Metadata = {
  title: "Email Engine",
  description:
    "AI-drafted, source-cited replies for a shared support mailbox.",
};

// Server Component by default (Architecture §15.7). Nothing here needs a client.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
