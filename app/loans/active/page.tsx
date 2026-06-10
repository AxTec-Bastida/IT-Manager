import { redirect } from "next/navigation";

export default function ActiveLoansPage() {
  redirect("/loans?view=active");
}
