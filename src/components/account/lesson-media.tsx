import { Download, FileText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { LessonMediaItem } from "@/server/services/media";

export function LessonMedia({
  items,
  courseSlug,
  lessonId,
}: {
  items: LessonMediaItem[];
  courseSlug: string;
  lessonId: string;
}) {
  if (items.length === 0) return null;
  const href = (id: string, extra = "") =>
    `/api/media/${id}?course=${encodeURIComponent(courseSlug)}&lesson=${encodeURIComponent(lessonId)}${extra}`;

  return (
    <div className="flex flex-col gap-5">
      {items.map((item) => {
        if (item.kind === "video") {
          if (!item.playback) {
            return (
              <p key={item.id} className="rounded-lg border p-4 text-sm text-muted-foreground">
                Das Video „{item.title}“ ist gerade nicht verfügbar. Bitte versuche es später noch
                einmal.
              </p>
            );
          }
          return (
            <figure key={item.id} className="flex flex-col gap-2">
              {item.playback.type === "iframe" ? (
                <div className="relative aspect-video overflow-hidden rounded-xl border bg-black">
                  <iframe
                    src={item.playback.url}
                    title={item.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <video
                  controls
                  preload="metadata"
                  controlsList="nodownload"
                  className="aspect-video w-full rounded-xl border bg-black"
                  src={item.playback.url}
                >
                  {item.playback.captions.map((c, i) => (
                    <track
                      key={c.language}
                      kind="subtitles"
                      srcLang={c.language}
                      label={c.label}
                      src={c.url}
                      default={i === 0}
                    />
                  ))}
                </video>
              )}
              <figcaption className="text-sm text-muted-foreground">{item.title}</figcaption>
            </figure>
          );
        }
        if (item.kind === "audio") {
          return (
            <figure key={item.id} className="flex flex-col gap-2 rounded-xl border p-4">
              <figcaption className="text-sm font-medium">{item.title}</figcaption>
              <audio
                controls
                preload="none"
                controlsList={item.downloadAllowed ? undefined : "nodownload"}
                className="w-full"
                src={href(item.id, "&play=1")}
              />
              {item.downloadAllowed ? (
                <a
                  href={href(item.id, "&download=1")}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "self-start",
                  })}
                >
                  <Download aria-hidden /> Herunterladen
                </a>
              ) : null}
            </figure>
          );
        }
        return (
          <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
            <FileText className="size-6 text-primary" aria-hidden />
            <span className="flex-1 font-medium">{item.title}</span>
            <a
              href={href(item.id)}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ansehen
            </a>
            {item.downloadAllowed ? (
              <a href={href(item.id, "&download=1")} className={buttonVariants({ size: "sm" })}>
                <Download aria-hidden /> Herunterladen
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
