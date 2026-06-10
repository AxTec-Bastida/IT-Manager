import { redirect } from "next/navigation";

export default function ActiveRmaPage() {
  redirect("/rma?status=active");
}
