"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { createViolationAction } from "@/app/actions";
import { normalizePlate } from "@/lib/plate";
import { todayInMalaysia } from "@/lib/datetime";

type UploadResult = { imagePath: string; thumbPath: string; width: number; height: number };

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  result?: UploadResult;
};

const COMPRESS_OPTIONS = {
  maxWidthOrHeight: 2200,
  maxSizeMB: 2,
  useWebWorker: true,
  fileType: "image/jpeg",
};

function uploadPhotoXHR(
  file: File,
  date: string,
  onProgress: (pct: number) => void,
  registerXhr: (xhr: XMLHttpRequest) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerXhr(xhr);
    xhr.open("POST", "/api/upload-photo");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Unexpected response from server."));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as UploadResult);
      } else {
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "Upload failed.";
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    const formData = new FormData();
    formData.set("date", date);
    formData.set("image", file);
    xhr.send(formData);
  });
}

export function UploadForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [plateInput, setPlateInput] = useState("");
  const [plates, setPlates] = useState<string[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const xhrById = useRef(new Map<string, XMLHttpRequest>());
  const itemsRef = useRef<UploadItem[]>([]);
  const handleFilesRef = useRef<(files: FileList | File[] | null) => void>(() => {});

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const xhrMap = xhrById.current;
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      xhrMap.forEach((xhr) => xhr.abort());
    };
  }, []);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          // Let the user paste text into inputs/textareas normally.
          const hasImage = Array.from(e.clipboardData.items).some((it) =>
            it.type.startsWith("image/"),
          );
          if (!hasImage) return;
        }
      }
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      handleFilesRef.current(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function startUpload(id: string, file: File) {
    updateItem(id, { status: "uploading", progress: 0, error: undefined });
    uploadPhotoXHR(
      file,
      date,
      (pct) => updateItem(id, { progress: pct }),
      (xhr) => xhrById.current.set(id, xhr),
    )
      .then((result) => updateItem(id, { status: "done", progress: 100, result }))
      .catch((err: Error) => updateItem(id, { status: "error", error: err.message }))
      .finally(() => xhrById.current.delete(id));
  }

  async function handleFilesSelected(fileList: FileList | File[] | null) {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError(null);

    for (const file of files) {
      const id = crypto.randomUUID();
      let compressed: File;
      try {
        compressed = await imageCompression(file, COMPRESS_OPTIONS);
      } catch {
        setError(`Couldn't process "${file.name}". Try a different file.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(compressed);
      setItems((prev) => [
        ...prev,
        { id, file: compressed, previewUrl, status: "uploading", progress: 0 },
      ]);
      startUpload(id, compressed);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  useEffect(() => {
    handleFilesRef.current = (files) => handleFilesSelected(files);
  });

  function removeItem(id: string) {
    xhrById.current.get(id)?.abort();
    xhrById.current.delete(id);
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function addPlate() {
    const value = normalizePlate(plateInput);
    if (value && !plates.includes(value)) {
      setPlates((prev) => [...prev, value]);
    }
    setPlateInput("");
  }

  function removePlate(index: number) {
    setPlates((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (items.some((item) => item.status === "uploading")) {
      setError("Please wait for photos to finish uploading.");
      return;
    }

    const doneItems = items.filter((item) => item.status === "done" && item.result);
    if (doneItems.length === 0) {
      setError("Add at least one photo.");
      return;
    }

    // If the user typed a plate but never clicked "Add" / pressed Enter,
    // don't silently drop it — commit it now before building the payload.
    const pendingPlate = normalizePlate(plateInput);
    const finalPlates =
      pendingPlate && !plates.includes(pendingPlate) ? [...plates, pendingPlate] : plates;
    if (pendingPlate) {
      setPlates(finalPlates);
      setPlateInput("");
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createViolationAction({
        date,
        description,
        plates: finalPlates,
        images: doneItems.map((item) => item.result!),
      });
      if ("error" in result) {
        setError(result.error);
        setIsSubmitting(false);
      } else {
        router.push(`/?date=${result.date}#${result.violationId}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  const hasUploadingItems = items.some((item) => item.status === "uploading");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Date</label>
        <input
          type="date"
          value={date}
          max={todayInMalaysia()}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm dark:border-white/15"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Photos</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-yellow file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-dark sm:w-auto"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium hover:bg-surface-muted dark:border-white/15"
          >
            📷 Take photo
          </button>
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          Photos start uploading as soon as you pick them. You can also paste (Ctrl/Cmd+V) a
          screenshot from your clipboard.
        </p>
        {items.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-black/10 dark:border-white/15"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />

                {item.status === "uploading" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white">
                    <span className="text-xs font-semibold">{item.progress}%</span>
                    <div className="h-1 w-3/4 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full bg-brand-yellow transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {item.status === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-brand-red/80 p-1 text-center text-white">
                    <span className="text-[10px] leading-tight">{item.error ?? "Failed"}</span>
                    <button
                      type="button"
                      onClick={() => startUpload(item.id, item.file)}
                      className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Plate number(s)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPlate();
              }
            }}
            placeholder="e.g. ABC 1234"
            className="flex-1 rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm uppercase dark:border-white/15"
          />
          <button
            type="button"
            onClick={addPlate}
            className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium hover:bg-surface-muted dark:border-white/15"
          >
            Add
          </button>
        </div>
        {plates.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plates.map((p, i) => (
              <span
                key={p}
                className="flex items-center gap-1 rounded-md border-2 border-brand-dark bg-brand-yellow px-1.5 py-0.5 font-mono text-xs font-bold text-brand-dark"
              >
                {p}
                <button type="button" onClick={() => removePlate(i)} aria-label={`Remove ${p}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What happened? Where was it parked?"
          className="w-full rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm dark:border-white/15"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || hasUploadingItems}
        className="rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : hasUploadingItems ? "Uploading photos…" : "Submit report"}
      </button>
    </form>
  );
}
