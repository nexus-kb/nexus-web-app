import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus KB Phase 0",
  description: "Nexus KB backend-first Phase 0 scaffold",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
