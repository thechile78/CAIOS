import "./globals.css";
import "./queue-controls.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CAIOS — Chilemaniacs Newsroom OS",
  description: "AI-assisted newsroom command center with mandatory human approval.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
