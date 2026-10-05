import { Badge } from "@/components/ui/badge";
import type { EntitlementState } from "@/server/domain/access";

export function CourseStateBadge({ state }: { state: EntitlementState }) {
  if (state === "active") return <Badge>Aktiv</Badge>;
  if (state === "expired") return <Badge variant="muted">Abgelaufen</Badge>;
  return <Badge variant="destructive">Gesperrt</Badge>;
}
