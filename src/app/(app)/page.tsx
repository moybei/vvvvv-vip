import { format, isValid, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getViolationsByDate } from "@/lib/violations";
import { todayInMalaysia } from "@/lib/datetime";
import { CalendarNav } from "@/components/CalendarNav";
import { ViolationGrid } from "@/components/ViolationGrid";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam && isValid(parseISO(dateParam)) ? dateParam : todayInMalaysia();

  const supabase = await createClient();
  const violations = await getViolationsByDate(supabase, date);

  const dateLabel = format(parseISO(date), "EEEE, d MMMM yyyy");

  return (
    <div className="flex flex-col gap-6">
      <CalendarNav />
      <ViolationGrid violations={violations} dateLabel={dateLabel} />
    </div>
  );
}
