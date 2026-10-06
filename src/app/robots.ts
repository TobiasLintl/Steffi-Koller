import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.seelenzeit.de";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/konto", "/admin", "/api/", "/anmelden", "/passwort-"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
