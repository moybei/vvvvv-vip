export function PlateChip({
  plateText,
  occurrenceCount,
  size = "sm",
}: {
  plateText: string;
  occurrenceCount: number;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={`relative inline-flex items-center rounded-md border-2 border-brand-dark bg-brand-yellow font-mono font-bold tracking-wide text-brand-dark ${
        size === "lg" ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-xs"
      }`}
    >
      {plateText}
      {occurrenceCount > 1 && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white"
          title={`Reported ${occurrenceCount} times`}
        >
          {occurrenceCount}
        </span>
      )}
    </span>
  );
}
