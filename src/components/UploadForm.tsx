"use client";

import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { format } from "date-fns";
import { createViolationAction } from "@/app/actions";
import { normalizePlate } from "@/lib/plate";

type ImageItem = { file: File; previewUrl: string };

const COMPRESS_OPTIONS = {
  maxWidthOrHeight: 2200,
  maxSizeMB: 2,
  useWebWorker: true,
  fileType: "image/jpeg",
};

export function UploadForm({ defaultDate }: { defaultDate: string }) {
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [plateInput, setPlateInput] = useState("");
  const [plates, setPlates] = useState<string[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setIsCompressing(true);
    setError(null);
    try {
      const newItems: ImageItem[] = [];
      for (const file of Array.from(fileList)) {
        const compressed = await imageCompression(file, COMPRESS_OPTIONS);
        newItems.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
      }
      setImages((prev) => [...prev, ...newItems]);
    } catch {
      setError("Couldn't process one of the photos. Try a different file.");
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
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
    if (images.length === 0) {
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

    const formData = new FormData();
    formData.set("date", date);
    formData.set("description", description);
    finalPlates.forEach((p) => formData.append("plates", p));
    images.forEach((img) => formData.append("images", img.file, img.file.name));

    try {
      const result = await createViolationAction(formData);
      if (result?.error) {
        setError(result.error);
        setIsSubmitting(false);
      }
      // On success the action redirects — this component unmounts.
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Date</label>
        <input
          type="date"
          value={date}
          max={format(new Date(), "yyyy-MM-dd")}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm dark:border-white/15"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Photos</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-yellow file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-dark"
        />
        {isCompressing && (
          <p className="mt-1 text-xs text-foreground/50">Processing photos…</p>
        )}
        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img, i) => (
              <div key={img.previewUrl} className="group relative aspect-square overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
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
        disabled={isSubmitting || isCompressing}
        className="rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : "Submit report"}
      </button>
    </form>
  );
}
