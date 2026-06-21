import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AeroRozum Warsaw26 Intelligence Analysis Pipeline",
  description: "Current-state intake, planning, evidence fusion, and assessment workflow.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg"
  }
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
