import { redirect } from "next/navigation";

export default function OverdueLoansPage() {
  redirect("/loans?view=overdue");
}
