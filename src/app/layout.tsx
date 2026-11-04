import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { getCapabilities, CapabilitiesProvider } from "@/features/capabilities";

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
  const capabilities = getCapabilities();

  return (
    <html lang="nl">
      <body className="flex min-h-screen flex-col items-center bg-slate-50 text-slate-900 antialiased">
        <main className="relative flex min-h-screen w-full max-w-md flex-col border-x border-slate-200 bg-white shadow-sm">
          <CapabilitiesProvider capabilities={capabilities}>
            {children}
            <FeedbackWidget />
          </CapabilitiesProvider>
        </main>
      </body>
    </html>
  );
}
