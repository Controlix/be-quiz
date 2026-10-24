import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KwisVrienden",
  description: "Quiz coördinatie app voor vrienden",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KwisVrienden",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased flex flex-col items-center">
        <main className="w-full max-w-md min-h-screen bg-white flex flex-col shadow-sm border-x border-slate-200">
          {children}
        </main>
      </body>
    </html>
  );
}
