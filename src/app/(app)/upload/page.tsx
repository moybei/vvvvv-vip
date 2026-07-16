import { todayInMalaysia } from "@/lib/datetime";
import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-xl font-bold tracking-tight">Report a violation</h1>
      <p className="mb-6 text-sm text-foreground/60">
        Add photos, the plate number(s), and a quick description.
      </p>
      <UploadForm defaultDate={todayInMalaysia()} />
    </div>
  );
}
