"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Plus, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBudgetItemAction, deleteBudgetItemAction, updateBudgetItemAction } from "@/features/developer/developer-actions";
import type { DeveloperBudgetItem } from "@/features/developer/developer-types";

type BudgetDraft = Omit<DeveloperBudgetItem, "id" | "updatedAt">;

const EMPTY_DRAFT: BudgetDraft = { serviceName: "", monthlyCostTry: 0, serviceUrl: "", notes: "", billingDay: null, isActive: true };
const tryFormatter = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });

function toDraft(item: DeveloperBudgetItem): BudgetDraft {
  return { serviceName: item.serviceName, monthlyCostTry: item.monthlyCostTry, serviceUrl: item.serviceUrl, notes: item.notes, billingDay: item.billingDay, isActive: item.isActive };
}

export function BudgetInterface({ initialItems }: { initialItems: DeveloperBudgetItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Record<string, BudgetDraft>>(() => Object.fromEntries(initialItems.map((item) => [item.id, toDraft(item)])));
  const [newDraft, setNewDraft] = useState<BudgetDraft>(EMPTY_DRAFT);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const visibleItems = useMemo(() => items.filter((item) => [item.serviceName, item.serviceUrl, item.notes].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [items, query]);
  const activeTotal = useMemo(() => items.filter((item) => item.isActive).reduce((sum, item) => sum + item.monthlyCostTry, 0), [items]);

  function saveNew() {
    startTransition(async () => {
      const response = await createBudgetItemAction(newDraft);
      setMessage(response.message);
      if (!response.ok) return;
      window.location.reload();
    });
  }

  function saveExisting(item: DeveloperBudgetItem) {
    startTransition(async () => {
      const response = await updateBudgetItemAction({ id: item.id, ...(drafts[item.id] ?? toDraft(item)) });
      setMessage(response.message);
      if (!response.ok) return;
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...(drafts[item.id] ?? toDraft(item)) } : entry));
    });
  }

  function remove(item: DeveloperBudgetItem) {
    startTransition(async () => {
      const response = await deleteBudgetItemAction(item.id);
      setMessage(response.message);
      if (response.ok) setItems((current) => current.filter((entry) => entry.id !== item.id));
    });
  }

  return <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-6 text-[#1f2922] sm:px-6 lg:px-10"><div className="mx-auto max-w-[92rem]">
    <header className="flex flex-col gap-4 border-b border-[#d9ddd4] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><a className="text-sm font-semibold text-[#4f6657] hover:underline" href="/developer">Developer workspace</a><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Budget interface</h1><p className="mt-2 text-sm leading-6 text-[#647168]">Her satır Supabase’de tutulur; aktif servisler aylık toplam maliyete dahil edilir.</p></div><div className="rounded-lg border border-[#d9ddd4] bg-[#fcfbf8] px-4 py-3"><p className="text-xs text-[#68756c]">Aylık aktif maliyet</p><p className="mt-1 text-xl font-semibold">{tryFormatter.format(activeTotal)}</p></div></header>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex h-10 max-w-lg items-center gap-2 rounded-lg border border-[#cdd4cb] bg-white px-3 text-[#667268] focus-within:border-[#71876f]"><Search className="size-4" /><input className="min-w-0 flex-1 bg-transparent text-sm text-[#1f2922] outline-none placeholder:text-[#93a098]" onChange={(event) => setQuery(event.target.value)} placeholder="Servis, link veya notlarda ara" value={query} /></label><p className="text-sm text-[#68756c]">{visibleItems.length} / {items.length} servis</p></div>
    <div className="mt-4 overflow-x-auto rounded-xl border border-[#d9ddd4] bg-[#fcfbf8]"><table className="min-w-[1080px] w-full border-collapse text-left text-sm"><thead><tr className="border-b border-[#d9ddd4] bg-[#efeee8] text-xs text-[#59675e]"><th className="px-3 py-3 font-semibold">Servis</th><th className="px-3 py-3 font-semibold">Aylık maliyet</th><th className="px-3 py-3 font-semibold">Link</th><th className="px-3 py-3 font-semibold">Fatura günü</th><th className="px-3 py-3 font-semibold">Not</th><th className="px-3 py-3 font-semibold">Durum</th><th className="w-28 px-3 py-3" /></tr></thead><tbody>
      <BudgetRow draft={newDraft} onChange={setNewDraft} onSave={saveNew} pending={pending} isNew />
      {visibleItems.map((item) => <BudgetRow draft={drafts[item.id] ?? toDraft(item)} key={item.id} onChange={(next) => setDrafts((current) => ({ ...current, [item.id]: next }))} onDelete={() => remove(item)} onSave={() => saveExisting(item)} pending={pending} />)}
    </tbody></table></div>{message ? <p className="mt-3 text-sm text-[#4f6657]" role="status">{message}</p> : null}
  </div></main>;
}

function BudgetRow({ draft, onChange, onSave, onDelete, pending, isNew = false }: { draft: BudgetDraft; onChange: (draft: BudgetDraft) => void; onSave: () => void; onDelete?: () => void; pending: boolean; isNew?: boolean }) {
  const update = (update: Partial<BudgetDraft>) => onChange({ ...draft, ...update });
  return <tr className="border-b border-[#e5e6e0] last:border-0"><td className="p-2"><input className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 outline-none hover:bg-[#f1f3ed] focus:border-[#9cad99] focus:bg-white" maxLength={120} onChange={(event) => update({ serviceName: event.target.value })} placeholder="Örn. Supabase" value={draft.serviceName} /></td><td className="p-2"><input className="h-9 w-36 rounded-md border border-transparent bg-transparent px-2 tabular-nums outline-none hover:bg-[#f1f3ed] focus:border-[#9cad99] focus:bg-white" min="0" onChange={(event) => update({ monthlyCostTry: Number(event.target.value) || 0 })} step="0.01" type="number" value={draft.monthlyCostTry} /></td><td className="p-2"><div className="flex items-center gap-1"><input className="h-9 min-w-52 rounded-md border border-transparent bg-transparent px-2 outline-none hover:bg-[#f1f3ed] focus:border-[#9cad99] focus:bg-white" maxLength={2048} onChange={(event) => update({ serviceUrl: event.target.value })} placeholder="https://..." value={draft.serviceUrl} />{draft.serviceUrl ? <a aria-label="Servis linkini yeni sekmede aç" className="p-2 text-[#526a58] hover:text-[#263d2c]" href={draft.serviceUrl} rel="noreferrer" target="_blank"><ExternalLink className="size-4" /></a> : null}</div></td><td className="p-2"><input className="h-9 w-24 rounded-md border border-transparent bg-transparent px-2 outline-none hover:bg-[#f1f3ed] focus:border-[#9cad99] focus:bg-white" max="31" min="1" onChange={(event) => update({ billingDay: event.target.value ? Number(event.target.value) : null })} placeholder="—" type="number" value={draft.billingDay ?? ""} /></td><td className="p-2"><input className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 outline-none hover:bg-[#f1f3ed] focus:border-[#9cad99] focus:bg-white" maxLength={2000} onChange={(event) => update({ notes: event.target.value })} placeholder="İç not" value={draft.notes} /></td><td className="p-2"><label className="flex items-center gap-2 px-2 text-xs text-[#536158]"><input checked={draft.isActive} onChange={(event) => update({ isActive: event.target.checked })} type="checkbox" />Aktif</label></td><td className="p-2"><div className="flex items-center justify-end gap-1"><Button aria-label={isNew ? "Bütçe satırı oluştur" : "Bütçe satırını kaydet"} className="size-8 rounded-md border border-transparent bg-[#dfead8] p-0 text-[#245132] hover:bg-[#cfe0c7]" disabled={pending} onClick={onSave} type="button">{isNew ? <Plus className="size-4" /> : <Save className="size-4" />}</Button>{!isNew ? <Button aria-label="Bütçe satırını sil" className="size-8 rounded-md border border-transparent bg-transparent p-0 text-[#9a554a] hover:bg-[#f7e6e1]" disabled={pending} onClick={onDelete} type="button"><Trash2 className="size-4" /></Button> : null}</div></td></tr>;
}
