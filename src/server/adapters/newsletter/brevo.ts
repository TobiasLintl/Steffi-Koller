import type { NewsletterAdapter } from "./types";

const API = "https://api.brevo.com/v3";

/** Brevo contacts API (DECISION D-05). Only called for confirmed DOI contacts. */
export function createBrevoNewsletterAdapter(config: {
  apiKey: string;
  listId: number;
  fetchImpl?: typeof fetch;
}): NewsletterAdapter {
  const doFetch = config.fetchImpl ?? fetch;
  const call = async (path: string, init: RequestInit) => {
    const response = await doFetch(`${API}${path}`, {
      ...init,
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
    });
    // 404 on removal = contact not on the list: nothing to do.
    if (
      !response.ok &&
      !(response.status === 404 && init.method === "POST" && path.includes("/remove"))
    ) {
      throw new Error(`Brevo ${init.method} ${path} failed with HTTP ${response.status}`);
    }
  };
  return {
    async upsertConfirmedContact(contact) {
      await call("/contacts", {
        method: "POST",
        body: JSON.stringify({
          email: contact.email,
          attributes: {
            ...(contact.firstName ? { FIRSTNAME: contact.firstName } : {}),
            DOI_CONFIRMED_AT: contact.consent.confirmedAt.toISOString(),
            CONSENT_VERSION: contact.consent.consentTextVersion,
          },
          listIds: [config.listId],
          updateEnabled: true,
        }),
      });
    },
    async unsubscribe(email) {
      await call(`/contacts/lists/${config.listId}/contacts/remove`, {
        method: "POST",
        body: JSON.stringify({ emails: [email] }),
      });
    },
  };
}
