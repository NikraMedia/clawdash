import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/lib/trpc/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { CommandPalette } from "@/components/command-palette";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Claw Dash",
  description: "Local dashboard for OpenClaw",
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
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-50`}
      >
        <TRPCReactProvider>
          <TooltipProvider>
            <div className="fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-zinc-950">
              <OfflineBanner />
              <div className="flex flex-1 overflow-hidden min-h-0 min-w-0">
                <Sidebar />
                <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0">
                  <Topbar />
                  <main className="flex-1 overflow-hidden min-h-0 min-w-0 flex flex-col relative w-full h-full">
                    {children}
                  </main>
                </div>
              </div>
            </div>
            <CommandPalette />
          </TooltipProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
