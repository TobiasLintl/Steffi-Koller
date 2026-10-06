"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { StartUploadResult } from "@/app/admin/(bereich)/medien/actions";

type Kind = "video" | "audio" | "pdf";

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (p: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload fehlgeschlagen"));
    xhr.send(file);
  });
}

/** Minimal TUS 1.0 client (create + chunked PATCH) for Bunny Stream uploads. */
async function tusUpload(
  endpoint: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (p: number) => void,
) {
  const create = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "Tus-Resumable": "1.0.0", "Upload-Length": String(file.size) },
  });
  const location = create.headers.get("Location");
  if (!create.ok || !location) throw new Error("Upload konnte nicht gestartet werden");
  const uploadUrl = new URL(location, endpoint).toString();
  const chunk = 32 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunk) {
    const response = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        ...headers,
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: file.slice(offset, offset + chunk),
    });
    if (!response.ok) throw new Error(`Upload fehlgeschlagen (${response.status})`);
    onProgress(Math.min(1, (offset + chunk) / file.size));
  }
}

export function MediaUploader({
  startUpload,
  finishUpload,
}: {
  startUpload: (input: {
    kind: Kind;
    title: string;
    fileName: string;
    contentType: string;
    size: number;
  }) => Promise<StartUploadResult>;
  finishUpload: (mediaId: string) => Promise<string>;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) return;
    setMessage(null);
    setProgress(0);
    try {
      const started = await startUpload({
        kind: data.get("kind") as Kind,
        title: String(data.get("title") || file.name),
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });
      if (!started.ok) throw new Error(started.message);
      if (started.target.protocol === "tus")
        await tusUpload(started.target.url, file, started.target.headers, setProgress);
      else await putWithProgress(started.target.url, file, started.target.headers, setProgress);
      const status = await finishUpload(started.mediaId);
      setMessage({
        ok: true,
        text:
          status === "ready" ? "Hochgeladen." : "Hochgeladen – das Video wird jetzt verarbeitet.",
      });
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Upload fehlgeschlagen.",
      });
    } finally {
      setProgress(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <FormField id="upload-kind" label="Art">
          <Select id="upload-kind" name="kind" defaultValue="pdf">
            <option value="pdf">PDF</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </Select>
        </FormField>
        <FormField id="upload-title" label="Titel">
          <Input
            id="upload-title"
            name="title"
            maxLength={200}
            placeholder="z. B. Workbook Modul 1"
          />
        </FormField>
      </div>
      <FormField id="upload-file" label="Datei">
        <Input
          id="upload-file"
          name="file"
          type="file"
          required
          accept="application/pdf,audio/*,video/*"
        />
      </FormField>
      {progress !== null ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}
      {message ? (
        <Alert variant={message.ok ? "success" : "destructive"}>{message.text}</Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={progress !== null}>
          Hochladen
        </Button>
      </div>
    </form>
  );
}
