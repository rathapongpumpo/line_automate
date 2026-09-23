"use client";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppState } from "@/hooks/use-app-state";
import { EmptyState, Spinner, Status, useToast } from "@/components/ui";
import type { LeadStatus } from "@/lib/types";
const filters: Array<{ value: "ALL" | LeadStatus; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "NEW", label: "ใหม่" },
  { value: "CONTACTED", label: "กำลังติดตาม" },
  { value: "INTERESTED", label: "สนใจ" },
  { value: "WON", label: "ปิดการขาย" },
  { value: "LOST", label: "ไม่สำเร็จ" },
];
const targetId = (value: string | null) => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};
export default function LeadsPage() {
  const params = useSearchParams();
  const requestedLeadId = targetId(params.get("lead"));
  return <LeadsContent key={requestedLeadId ?? "leads"} requestedLeadId={requestedLeadId} />;
}

function LeadsContent({ requestedLeadId }: { requestedLeadId?: number }) {
  const { data, loading, refresh } = useAppState();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [selectedId, setSelectedId] = useState<number | undefined>(requestedLeadId);
  const detailRef = useRef<HTMLElement>(null);
  const leads = useMemo(
    () =>
      data?.leads.filter(
        (item) =>
          (filter === "ALL" || item.status === filter) &&
          `${item.customerName} ${item.phone ?? ""} ${item.product}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ) ?? [],
    [data, filter, query],
  );
  const selected = data?.leads.find((item) => item.id === selectedId);
  useEffect(() => {
    if (!requestedLeadId || !selected || !window.matchMedia("(max-width: 1279px)").matches) return;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [requestedLeadId, selected]);
  async function updateStatus(status: LeadStatus) {
    if (!selected) return;
    const response = await fetch(`/api/leads/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      toast("อัปเดตสถานะ Lead แล้ว");
      await refresh();
    } else toast("อัปเดตสถานะไม่สำเร็จ", "error");
  }
  if (loading) return <Spinner />;
  return (
    <div className="mx-auto max-w-[1320px]">
      <h1 className="page-title">ลีด</h1>
      <p className="mt-2 text-slate-500">
        ติดตามโอกาสขายจากบทสนทนา LINE ในที่เดียว
      </p>
      <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`min-h-11 shrink-0 rounded-[10px] px-4 font-medium ${filter === item.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative w-full xl:w-80">
          <Search className="absolute left-3 top-3 text-slate-400" size={19} />
          <input
            className="control w-full pl-10 pr-12"
            placeholder="ค้นหา Lead"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              aria-label="ล้างการค้นหา"
              onClick={() => setQuery("")}
              className="absolute right-1 top-0 grid size-11 place-items-center"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="panel overflow-hidden">
          {leads.length === 0 ? (
            <EmptyState
              title="ยังไม่มี Lead"
              body="เมื่อมีลูกค้าสนใจสินค้า Lead จะปรากฏที่นี่"
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {[
                        "ชื่อ",
                        "สินค้า",
                        "โทรศัพท์",
                        "สถานะ",
                        "แหล่งที่มา",
                        "วันที่",
                        "ผู้ดูแล",
                      ].map((label) => (
                        <th
                          key={label}
                          className="whitespace-nowrap px-4 py-3 font-medium"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedId(lead.id)}
                        className={`hover:bg-slate-50 ${selectedId === lead.id ? "bg-emerald-50/50" : ""}`}
                      >
                        <td className="px-4 py-4 font-medium">
                          <span>{lead.customerName}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {lead.product}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {lead.phone || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <Status value={lead.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {lead.source}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                          {new Intl.DateTimeFormat("th-TH", {
                            day: "numeric",
                            month: "short",
                          }).format(new Date(lead.createdAt))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {lead.owner}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                    className="w-full p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{lead.customerName}</span>
                      <Status value={lead.status} />
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {lead.product} · {lead.color} {lead.size}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {lead.phone || "ยังไม่มีเบอร์โทร"} · {lead.owner}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        <aside ref={detailRef} className="panel h-fit scroll-mt-20 p-5">
          <h2 className="font-semibold">รายละเอียด Lead</h2>
          {selected ? (
            <div className="mt-5 space-y-5">
              <div>
                <div className="text-xl font-semibold">
                  {selected.customerName}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {selected.phone || "ยังไม่มีเบอร์โทร"}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-slate-500">สินค้า</dt>
                <dd className="font-medium">{selected.product}</dd>
                <dt className="text-slate-500">สี / ไซซ์</dt>
                <dd>
                  {selected.color || "—"} / {selected.size || "—"}
                </dd>
                <dt className="text-slate-500">แหล่งที่มา</dt>
                <dd>{selected.source}</dd>
                <dt className="text-slate-500">ผู้ดูแล</dt>
                <dd>{selected.owner}</dd>
              </dl>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">สถานะ</span>
                <select
                  className="control w-full px-3"
                  value={selected.status}
                  onChange={(e) =>
                    void updateStatus(e.target.value as LeadStatus)
                  }
                >
                  {filters.slice(1).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              เลือก Lead เพื่อดูและแก้สถานะ
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
