import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zero Stage Current-State Intake",
  description: "Hackathon prototype for current-state evidence intake and analyst summarization."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
