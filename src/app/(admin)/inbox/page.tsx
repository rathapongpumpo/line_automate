"use client";
import {
  ArrowLeft,
  Clock3,
  Info,
  Search,
  Send,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, EmptyState, Spinner, Status, useToast } from "@/components/ui";
import { useAppState } from "@/hooks/use-app-state";
const time = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
export default function InboxPage() {
  const params = useSearchParams();
  const { data, loading, refresh } = useAppState();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | undefined>(
    params.get("conversation") ? Number(params.get("conversation")) : undefined,
  );
  const [pane, setPane] = useState<"list" | "chat" | "detail">("list");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const conversations = useMemo(
    () =>
      data?.conversations.filter((item) =>
        `${item.customer.displayName} ${item.lastMessage}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) ?? [],
    [data, query],
  );
  const selected = data?.conversations.find(
    (item) => item.id === (selectedId ?? conversations[0]?.id),
  );
  function select(id: number) {
    setSelectedId(id);
    setPane("chat");
  }
  async function takeover() {
    if (!selected) return;
    setBusy(true);
    const response = await fetch(`/api/conversations/${selected.id}/takeover`, {
      method: "POST",
    });
    setBusy(false);
    if (response.ok) {
      toast("รับช่วงการสนทนาแล้ว");
      await refresh();
    } else toast("รับช่วงไม่สำเร็จ", "error");
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !message.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/conversations/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setBusy(false);
    if (response.ok) {
      setMessage("");
      await refresh();
    } else toast("ส่งข้อความไม่สำเร็จ", "error");
  }
  if (loading) return <Spinner />;
  return (
    <div className="mx-auto max-w-[1460px]">
      <div className="mb-5">
        <h1 className="page-title">กล่องข้อความ</h1>
        <p className="mt-2 text-slate-500">
          จัดการบทสนทนา ดูข้อมูลลูกค้า และรับช่วงจาก Automation
        </p>
      </div>
      <section className="panel min-h-[calc(100dvh-190px)] overflow-hidden">
        <div className="grid min-h-[inherit] lg:grid-cols-[320px_minmax(380px,1fr)_320px]">
          <aside
            className={`${pane !== "list" ? "hidden" : "flex"} min-h-[inherit] flex-col border-r border-slate-200 lg:flex`}
          >
            <div className="border-b border-slate-200 p-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-3 text-slate-400"
                  size={18}
                />
                <input
                  className="control w-full pl-10 pr-11"
                  placeholder="ค้นหาการสนทนา"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    aria-label="ล้างการค้นหา"
                    onClick={() => setQuery("")}
                    className="absolute right-0 top-0 grid size-11 place-items-center"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 divide-y divide-slate-100 overflow-auto">
              {conversations.length === 0 ? (
                <EmptyState title="ไม่พบการสนทนา" body="ลองใช้คำค้นหาอื่น" />
              ) : (
                conversations.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => select(item.id)}
                    className={`flex w-full gap-3 p-4 text-left hover:bg-slate-50 ${selected?.id === item.id ? "bg-emerald-50" : ""}`}
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 font-semibold">
                      {item.customer.displayName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">
                          {item.customer.displayName}
                        </span>
                        <time className="text-xs text-slate-400">
                          {time(item.lastMessageAt)}
                        </time>
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-500">
                        {item.lastMessage}
                      </div>
                      <div className="mt-2">
                        <Status value={item.status} />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
          <main
            className={`${pane !== "chat" ? "hidden" : "flex"} min-h-[inherit] flex-col lg:flex`}
          >
            {selected ? (
              <>
                <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-3 sm:px-5">
                  <button
                    aria-label="กลับไปรายการ"
                    onClick={() => setPane("list")}
                    className="grid size-11 place-items-center rounded-lg hover:bg-slate-100 lg:hidden"
                  >
                    <ArrowLeft size={19} />
                  </button>
                  <div className="grid size-10 place-items-center rounded-full bg-slate-100 font-semibold">
                    {selected.customer.displayName.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {selected.customer.displayName}
                    </div>
                    <Status value={selected.status} />
                  </div>
                  <button
                    aria-label="ดูข้อมูลลูกค้า"
                    onClick={() => setPane("detail")}
                    className="grid size-11 place-items-center rounded-lg hover:bg-slate-100 lg:hidden"
                  >
                    <Info size={19} />
                  </button>
                </header>
                <div className="flex-1 space-y-4 overflow-auto bg-slate-50/60 p-4 sm:p-6">
                  {selected.messages.map((item) => (
                    <div
                      key={item.id}
                      className={`flex ${item.sender === "CUSTOMER" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 ${item.sender === "CUSTOMER" ? "rounded-bl-sm border border-slate-200 bg-white" : item.sender === "SYSTEM" ? "rounded-br-sm bg-slate-200 text-slate-800" : "rounded-br-sm bg-emerald-100 text-emerald-950"}`}
                      >
                        <div className="mb-1 text-[11px] font-semibold text-slate-500">
                          {item.sender === "CUSTOMER"
                            ? "ลูกค้า"
                            : item.sender === "SYSTEM"
                              ? "ระบบ"
                              : "Admin"}
                        </div>
                        <p className="whitespace-pre-wrap leading-6">
                          {item.body}
                        </p>
                        <time className="mt-1 block text-right text-[10px] text-slate-400">
                          {time(item.createdAt)}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 bg-white p-3">
                  <form noValidate onSubmit={send} className="flex gap-2">
                    <input
                      className="control min-w-0 flex-1 px-3"
                      placeholder={
                        selected.status === "ADMIN"
                          ? "พิมพ์ข้อความถึงลูกค้า..."
                          : "รับช่วงก่อนส่งข้อความ"
                      }
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={selected.status !== "ADMIN"}
                    />
                    <Button
                      type="submit"
                      busy={busy}
                      disabled={selected.status !== "ADMIN" || !message.trim()}
                      aria-label="ส่งข้อความ"
                      className="px-3"
                    >
                      <Send size={18} />
                      <span className="hidden sm:inline">ส่ง</span>
                    </Button>
                  </form>
                  {selected.status !== "ADMIN" && (
                    <Button
                      onClick={takeover}
                      busy={busy}
                      className="mt-3 w-full"
                    >
                      <UserRoundCheck size={18} />
                      รับช่วงสนทนา
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                title="ยังไม่มีการสนทนา"
                body="ข้อความจากลูกค้าจะปรากฏที่นี่"
              />
            )}
          </main>
          <aside
            className={`${pane !== "detail" ? "hidden" : "block"} border-l border-slate-200 p-5 lg:block`}
          >
            {selected ? (
              <>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="กลับไปแชต"
                    onClick={() => setPane("chat")}
                    className="grid size-11 place-items-center rounded-lg hover:bg-slate-100 lg:hidden"
                  >
                    <ArrowLeft size={19} />
                  </button>
                  <h2 className="text-lg font-semibold">ข้อมูลลูกค้า</h2>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-full bg-slate-100 text-lg font-bold">
                    {selected.customer.displayName.slice(0, 1)}
                  </div>
                  <div>
                    <div className="font-semibold">
                      {selected.customer.displayName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {selected.customer.lineUserId}
                    </div>
                  </div>
                </div>
                <dl className="mt-6 grid grid-cols-[110px_1fr] gap-y-3 text-sm">
                  <dt className="text-slate-500">เบอร์โทร</dt>
                  <dd>{selected.customer.phone || "ยังไม่มี"}</dd>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="break-all">
                    {selected.customer.email || "ยังไม่มี"}
                  </dd>
                  <dt className="text-slate-500">เริ่มสนทนา</dt>
                  <dd>
                    {new Intl.DateTimeFormat("th-TH", {
                      dateStyle: "medium",
                    }).format(new Date(selected.customer.createdAt))}
                  </dd>
                </dl>
                <div className="my-6 border-t border-slate-200" />
                <h3 className="font-semibold">ความสนใจ</h3>
                <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-3 text-sm">
                  <dt className="text-slate-500">สินค้า</dt>
                  <dd className="font-medium">
                    {selected.customer.interestedProduct || "ยังไม่ระบุ"}
                  </dd>
                  <dt className="text-slate-500">สี</dt>
                  <dd>{selected.customer.color || "—"}</dd>
                  <dt className="text-slate-500">ไซซ์</dt>
                  <dd>{selected.customer.size || "—"}</dd>
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  {selected.customer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  <Clock3 size={16} />
                  อัปเดตล่าสุด {time(selected.lastMessageAt)}
                </div>
              </>
            ) : (
              <EmptyState
                title="เลือกการสนทนา"
                body="ข้อมูลลูกค้าจะปรากฏที่นี่"
              />
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
