import type { Metadata, Viewport } from "next";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { ConsentScripts } from "@/components/consent/consent-scripts";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.seelenzeit.de";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Seelenzeit",
    template: "%s · Seelenzeit",
  },
  description:
    "Selbstlernkurse für mehr Ruhe, Klarheit und Verbindung mit dir selbst – in deinem Tempo, ohne Abo.",
  openGraph: { siteName: "Seelenzeit", locale: "de_DE", type: "website" },
  twitter: { card: "summary" },
  alternates: { canonical: "./" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3f6f5e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#inhalt"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Zum Inhalt springen
        </a>
        <div id="inhalt" className="flex flex-1 flex-col">
          {children}
        </div>
        <ConsentBanner />
        <ConsentScripts
          statisticsScriptUrl={process.env.NEXT_PUBLIC_STATISTICS_SCRIPT_URL}
          statisticsDomain={process.env.NEXT_PUBLIC_STATISTICS_DOMAIN}
        />
      </body>
    </html>
  );
}
