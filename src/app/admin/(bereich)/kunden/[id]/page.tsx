import Link from "next/link";
import { notFound } from "next/navigation";

import { CourseStateBadge } from "@/components/account/course-state-badge";
import { ActionForm } from "@/components/admin/action-form";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { countryName } from "@/lib/countries";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  getCustomerFile,
  getCustomerFileExtras,
  listCoursesForSelect,
} from "@/server/services/customers";
import {
  addSupportNoteAction,
  extendAccessAction,
  grantAccessAction,
  revokeAccessAction,
} from "./actions";

const EVENT_LABELS = {
  granted: "Freigeschaltet",
  extended: "Verlängert",
  revoked: "Gesperrt",
  reinstated: "Wieder freigeschaltet",
  reduced: "Verlängerung zurückgenommen",
};

export default async function CustomerFilePage({ params }: PageProps<"/admin/kunden/[id]">) {
  const { id } = await params;
  const actor = await requirePermission("customers:read", `/admin/kunden/${id}`);
  const file = await getCustomerFile(db, id);
  if (!file || file.user.role !== "customer") notFound();
  const canWrite = hasPermission(actor.role, "entitlements:write");
  const extras = await getCustomerFileExtras(db, file.user.id, file.user.email, {
    orders: hasPermission(actor.role, "orders:read"),
    newsletter: hasPermission(actor.role, "newsletter:read"),
    support: hasPermission(actor.role, "support:write"),
  });
  const courseOptions = canWrite ? await listCoursesForSelect(db) : [];
  const p = file.profile;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/kunden" className="text-sm text-muted-foreground hover:underline">
          ← Kunden
        </Link>
        <h1 className="text-2xl font-semibold">{file.user.name}</h1>
        <p className="text-sm text-muted-foreground">
          {file.user.email} · Konto seit {formatDate(file.user.createdAt)} ·{" "}
          {file.user.emailVerified ? "E-Mail bestätigt" : "E-Mail nicht bestätigt"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
        </CardHeader>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Typ</dt>
          <dd>
            <Badge variant="outline">{p?.customerType === "b2b" ? "B2B" : "B2C"}</Badge>
          </dd>
          <dt className="text-muted-foreground">Name</dt>
          <dd>{[p?.firstName, p?.lastName].filter(Boolean).join(" ") || "–"}</dd>
          {p?.customerType === "b2b" ? (
            <>
              <dt className="text-muted-foreground">Firma</dt>
              <dd>{p.companyName ?? "–"}</dd>
              <dt className="text-muted-foreground">USt-IdNr.</dt>
              <dd>{p.vatId ?? "–"}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Anschrift</dt>
          <dd>
            {[p?.street, [p?.postalCode, p?.city].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", ") || "–"}
          </dd>
          <dt className="text-muted-foreground">Land</dt>
          <dd>{countryName(p?.country)}</dd>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zugänge</CardTitle>
        </CardHeader>
        {file.entitlements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Zugänge.</p>
        ) : null}
        <ul className="flex flex-col gap-4">
          {file.entitlements.map((e) => (
            <li key={e.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{e.course.title}</p>
                <CourseStateBadge state={e.state} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Start {formatDate(e.startsAt)} ·{" "}
                {e.expiresAt ? `bis ${formatDate(e.expiresAt)}` : "unbegrenzt"} · Quelle:{" "}
                {e.source === "purchase" ? "Kauf" : e.source === "free" ? "kostenlos" : "manuell"}
              </p>
              {(() => {
                const p = extras.progress.find((x) => x.courseId === e.course.id);
                return (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fortschritt:{" "}
                    {p
                      ? `${p.completed} von ${p.total} Lektionen erledigt · zuletzt aktiv ${formatDate(p.lastViewedAt)}`
                      : "noch nicht begonnen"}
                  </p>
                );
              })()}
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer">Verlauf ({e.events.length})</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {e.events.map((ev) => (
                    <li key={ev.id} className="text-muted-foreground">
                      {formatDateTime(ev.createdAt)} · {EVENT_LABELS[ev.type]}
                      {ev.newExpiresAt ? ` → ${formatDate(ev.newExpiresAt)}` : ""}
                      {ev.reason ? ` · „${ev.reason}“` : ""}
                    </li>
                  ))}
                </ul>
              </details>
              {canWrite ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ActionForm
                    action={extendAccessAction.bind(null, file.user.id)}
                    submitLabel="Verlängern"
                    variant="outline"
                  >
                    <input type="hidden" name="courseId" value={e.course.id} />
                    <FormField id={`ext-months-${e.id}`} label="Monate">
                      <Input
                        id={`ext-months-${e.id}`}
                        name="months"
                        type="number"
                        min={1}
                        max={120}
                        defaultValue={3}
                        required
                      />
                    </FormField>
                    <FormField id={`ext-reason-${e.id}`} label="Begründung">
                      <Input id={`ext-reason-${e.id}`} name="reason" required minLength={3} />
                    </FormField>
                  </ActionForm>
                  {e.status === "active" ? (
                    <ActionForm
                      action={revokeAccessAction.bind(null, file.user.id)}
                      submitLabel="Sperren"
                      variant="destructive"
                      confirm="Zugang wirklich sperren?"
                    >
                      <input type="hidden" name="courseId" value={e.course.id} />
                      <FormField id={`rev-reason-${e.id}`} label="Begründung">
                        <Input id={`rev-reason-${e.id}`} name="reason" required minLength={3} />
                      </FormField>
                    </ActionForm>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>Zugang manuell freischalten</CardTitle>
          </CardHeader>
          <ActionForm
            action={grantAccessAction.bind(null, file.user.id)}
            submitLabel="Freischalten"
            className="max-w-lg"
          >
            <FormField id="grant-course" label="Kurs">
              <Select id="grant-course" name="courseId" required defaultValue="">
                <option value="" disabled>
                  Bitte wählen
                </option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="grant-months" label="Dauer">
              <Select id="grant-months" name="months" defaultValue="6">
                <option value="3">3 Monate</option>
                <option value="6">6 Monate</option>
                <option value="12">12 Monate</option>
                <option value="24">24 Monate</option>
                <option value="unlimited">Unbegrenzt</option>
              </Select>
            </FormField>
            <FormField id="grant-reason" label="Begründung">
              <Textarea id="grant-reason" name="reason" required minLength={3} rows={2} />
            </FormField>
          </ActionForm>
        </Card>
      ) : null}
      {extras.orders ? (
        <Card>
          <CardHeader>
            <CardTitle>Käufe</CardTitle>
          </CardHeader>
          {extras.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Käufe.</p>
          ) : null}
          <ul className="flex flex-col divide-y text-sm">
            {extras.orders.map(({ order, productTitle }) => (
              <li key={order.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {formatDateTime(order.purchasedAt)} · {productTitle ?? order.providerProductId}
                  {order.isTest ? " (Test)" : ""}
                </span>
                <span className="tabular-nums">
                  {formatMoney(order.amountMinor, order.currency ?? "EUR")} · {order.status} ·{" "}
                  {order.provider} {order.receiptReference}
                  {order.customerType === "b2b"
                    ? ` · B2B ${order.companyName ?? ""} ${order.vatId ?? ""}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {extras.newsletter !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle>Newsletter</CardTitle>
          </CardHeader>
          <p className="text-sm">
            {extras.newsletter
              ? `${extras.newsletter.status === "confirmed" ? "Bestätigt (DOI)" : extras.newsletter.status === "pending" ? "Unbestätigt" : "Abgemeldet"} · angemeldet ${formatDateTime(extras.newsletter.subscribedAt)}${
                  extras.newsletter.confirmedAt
                    ? ` · bestätigt ${formatDateTime(extras.newsletter.confirmedAt)}`
                    : ""
                } · Text-Version ${extras.newsletter.consentTextVersion}`
              : "Nicht angemeldet."}
          </p>
        </Card>
      ) : null}

      {extras.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
          </CardHeader>
          {extras.messages && extras.messages.length ? (
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">Nachrichten</p>
              <ul className="flex flex-col gap-1">
                {extras.messages.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/admin/nachrichten?status=all#${m.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {formatDateTime(m.createdAt)} · {m.subject}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      ({m.status === "open" ? "offen" : "erledigt"})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">Notizen</p>
            {extras.notes.length === 0 ? (
              <p className="text-muted-foreground">Noch keine Notizen.</p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {extras.notes.map((n) => (
                <li key={n.id} className="rounded-md bg-muted/50 p-3">
                  <p className="whitespace-pre-line">{n.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.authorName ?? "–"} · {formatDateTime(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <ActionForm
            action={addSupportNoteAction.bind(null, file.user.id)}
            submitLabel="Notiz speichern"
            variant="outline"
            className="max-w-xl"
          >
            <FormField id="note" label="Neue Notiz">
              <Textarea id="note" name="note" rows={3} required />
            </FormField>
          </ActionForm>
        </Card>
      ) : null}
    </div>
  );
}
