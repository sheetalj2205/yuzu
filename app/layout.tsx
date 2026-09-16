import "./globals.css";
import type { Metadata, Viewport } from "next";
import InstallPrompt from "@/components/InstallPrompt";
import BuzzPulse from "@/components/BuzzPulse";

export const metadata: Metadata = {
  title: "Yuzu",
  description: "Pain travels one way. Comfort travels back.",
  manifest: "/manifest.webmanifest",
  applicationName: "Yuzu",
  appleWebApp: { capable: true, title: "Yuzu", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E5326E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Next emits the modern "mobile-web-app-capable", but iOS Safari still
            only honours this legacy one. Without it iOS saves a bookmark that
            opens in browser chrome instead of as an app. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap"
        />
      </head>
      <body className="font-body text-ink antialiased">
        {children}
        <BuzzPulse />
        <InstallPrompt />
      </body>
    </html>
  );
}
