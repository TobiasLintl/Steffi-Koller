"use client";

import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SortableItem {
  id: string;
  label: string;
  href?: string;
  meta?: string;
}

/**
 * Drag & drop ordering (mouse/touchpad) with arrow buttons as keyboard/mobile alternative.
 * Calls `onReorder` with the complete new id order.
 */
export function SortableList({
  items,
  onReorder,
  label,
}: {
  items: SortableItem[];
  onReorder: (ids: string[]) => Promise<void>;
  label: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastKey, setLastKey] = useState(items.map((i) => i.id).join());

  // Server data changed (e.g. item added) → adopt it.
  const key = items.map((i) => `${i.id}:${i.label}`).join();
  if (key !== lastKey) {
    setLastKey(key);
    setOrder(items);
  }

  function commit(next: SortableItem[]) {
    setOrder(next);
    startTransition(async () => {
      await onReorder(next.map((i) => i.id));
      router.refresh();
    });
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    commit(next);
  }

  return (
    <ol aria-label={label} className={cn("flex flex-col gap-1", pending && "opacity-70")}>
      {order.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => setDragging(item.id)}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!dragging || dragging === item.id) return;
            const next = order.filter((i) => i.id !== dragging);
            const moved = order.find((i) => i.id === dragging)!;
            next.splice(
              next.findIndex((i) => i.id === item.id) +
                (order.findIndex((i) => i.id === dragging) < index ? 1 : 0),
              0,
              moved,
            );
            commit(next);
          }}
          className={cn(
            "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
            dragging === item.id && "opacity-50",
          )}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {item.href ? (
              <Link href={item.href} className="underline-offset-4 hover:underline">
                {item.label}
              </Link>
            ) : (
              item.label
            )}
            {item.meta ? (
              <span className="ml-2 text-xs text-muted-foreground">{item.meta}</span>
            ) : null}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => move(index, -1)}
            disabled={index === 0 || pending}
            aria-label={`${item.label} nach oben`}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => move(index, 1)}
            disabled={index === order.length - 1 || pending}
            aria-label={`${item.label} nach unten`}
          >
            ↓
          </Button>
        </li>
      ))}
    </ol>
  );
}
