import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = `${month}-01`;
  const [year, monthNum] = month.split("-").map(Number);
  const nextMonth = monthNum === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("violations")
    .select("violation_date")
    .gte("violation_date", start)
    .lt("violation_date", nextMonth);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dates = Array.from(new Set((data ?? []).map((r) => r.violation_date)));
  return NextResponse.json({ dates });
}
