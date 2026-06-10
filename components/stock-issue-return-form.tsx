"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StockIssue, StockItem } from "@prisma/client";
import { RotateCcw } from "lucide-react";
import { stockReturnConditionLabels, stockReturnConditionOptions } from "@/lib/constants";

type Props = {
  issue: StockIssue & { stockItem: StockItem };
};

export function StockIssueReturnForm({ issue }: Props) {
  const router = useRouter();
  const remaining = issue.quantity - issue.returnedQuantity;
  const [condition, setCondition] = useState("GOOD");
  const [quantity, setQuantity] = useState(Math.max(1, remaining));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const usable = condition === "GOOD" || condition === "FAIR";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = {
      returnedQuantity: quantity,
      conditionIn: condition,
      returnedAt: formData.get("returnedAt"),
      returnNotes: formData.get("returnNotes"),
    };
    const response = await fetch(`/api/stock/issues/${issue.id}/return`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to return stock loan.");
      return;
    }
    router.push(`/stock/issues/${data.issue.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Return loaned stock</h2>
        <p className="mt-1 text-sm text-slate-500">{remaining} of {issue.quantity} still pending for {issue.stockItem.name}.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Returned quantity
            <input className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" type="number" min="1" max={remaining} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Return condition
            <select className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" value={condition} onChange={(event) => setCondition(event.target.value)}>
              {stockReturnConditionOptions.map((option) => <option key={option} value={option}>{stockReturnConditionLabels[option]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Returned date
            <input className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base" name="returnedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <div className={`rounded-md p-3 text-sm ${usable ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
            {usable ? "Good/Fair returns will increase usable stock." : "Damaged, not working, or missing returns will not increase usable stock."}
          </div>
          <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
            Return notes
            <textarea className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base" name="returnNotes" />
          </label>
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
        <button className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto" disabled={saving || remaining <= 0 || quantity > remaining}>
          <RotateCcw size={18} />
          {saving ? "Saving..." : "Confirm return"}
        </button>
      </section>
    </form>
  );
}
