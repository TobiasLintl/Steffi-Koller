"use client";

import { useEffect } from "react";

import { readConsent } from "./consent-banner";

/**
 * Loads optional analytics only after consent for "Statistik" (CLAUDE.md §6). Nothing is
 * configured by default, so no tracking happens at all until a script URL is set.
 */
export function ConsentScripts({
  statisticsScriptUrl,
  statisticsDomain,
  nonce,
}: {
  statisticsScriptUrl?: string;
  statisticsDomain?: string;
  nonce?: string;
}) {
  useEffect(() => {
    function apply() {
      if (!statisticsScriptUrl || !readConsent()?.statistics) return;
      if (document.querySelector('script[data-consent="statistics"]')) return;
      const script = document.createElement("script");
      script.src = statisticsScriptUrl;
      script.defer = true;
      script.dataset.consent = "statistics";
      if (nonce) script.nonce = nonce;
      if (statisticsDomain) script.dataset.domain = statisticsDomain;
      document.head.appendChild(script);
    }
    apply();
    window.addEventListener("seelenzeit:consent-changed", apply);
    return () => window.removeEventListener("seelenzeit:consent-changed", apply);
  }, [statisticsScriptUrl, statisticsDomain, nonce]);
  return null;
}
