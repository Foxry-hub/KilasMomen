import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photobooth Kios — Localhost",
  description:
    "Photobooth kios offline-first dengan UI Neo-Brutalism. Bayar, jepret, cetak!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans text-ink bg-paper">
        {children}
      </body>
    </html>
  );
}
