import { Badge } from "@/components/ui/badge";

const LABELS = {
  received: "empfangen",
  processed: "verarbeitet",
  ignored: "ignoriert",
  failed: "fehlgeschlagen",
} as const;

export function WebhookStatusBadge({ status }: { status: keyof typeof LABELS }) {
  const variant =
    status === "processed" ? "default" : status === "failed" ? "destructive" : "muted";
  return <Badge variant={variant}>{LABELS[status]}</Badge>;
}
