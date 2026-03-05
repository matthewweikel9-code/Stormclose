import { redirect } from "next/navigation";

export default function LegacyReportRoute() {
  redirect("/dashboard/report");
}
