"use client";
import { ArrowLeft, CheckCheck, Send, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, useToast } from "@/components/ui";
import { useAppState } from "@/hooks/use-app-state";

type DemoMessage = {
  id: number;
  sender: "CUSTOMER" | "SYSTEM";
  body: string;
  time: string;
};
const shortcuts = [
  "มีเสื้อสีดำ XL ไหม",
  "ราคาเท่าไหร่",
  "ส่งของกี่วัน",
  "สนใจครับ เบอร์ 0812345678",
  "ขอคุยกับเจ้าหน้าที่",
];
const initialMessages: DemoMessage[] = [
  {
    id: 1,
    sender: "SYSTEM",
    body: "สวัสดีครับ 👋\nยินดีต้อนรับสู่ WLB Store\nสอบถามสินค้า ราคา ไซซ์ หรือการจัดส่งได้เลยครับ",
    time: "09:41",
  },
];
const currentTime = () =>
  new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

export default function DemoPage() {
  const { refresh } = useAppState();
  const toast = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>(initialMessages);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(2);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  async function send(text = input) {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((items) => [
      ...items,
      {
        id: idRef.current++,
        sender: "CUSTOMER",
        body: clean,
        time: currentTime(),
      },
    ]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean }),
      });
      const body = (await response.json()) as {
        reply?: string;
        status?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error);
      await new Promise((resolve) => setTimeout(resolve, 450));
      setMessages((items) => [
        ...items,
        {
          id: idRef.current++,
          sender: "SYSTEM",
          body: body.reply || "",
          time: currentTime(),
        },
      ]);
      await refresh();
      if (body.status === "WAITING") toast("ส่งต่อให้ Admin แล้ว", "info");
    } catch {
      toast("ส่งข้อความไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft size={17} />
            กลับภาพรวม
          </Link>
          <h1 className="page-title">Demo ลูกค้า</h1>
          <p className="mt-2 text-slate-500">
            จำลองบทสนทนาจาก LINE และดูข้อมูลเปลี่ยนในระบบจริง
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex">
          <Smartphone size={18} />
          Customer simulator
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="panel h-fit p-5">
          <h2 className="text-lg font-semibold">Golden Demo Flow</h2>
          <p className="mt-1 text-sm text-slate-500">
            กดข้อความตัวอย่างตามลำดับ หรือพิมพ์เองได้
          </p>
          <div className="mt-5 space-y-2">
            {shortcuts.map((item, index) => (
              <button
                key={item}
                onClick={() => void send(item)}
                disabled={busy}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span>{item}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            หลังส่ง “สนใจครับ เบอร์…” ให้เปิด Dashboard และ Leads เพื่อดู Lead
            ใหม่ จากนั้นส่ง “ขอคุยกับเจ้าหน้าที่” แล้วไปรับช่วงที่ Inbox
          </div>
        </section>
        <section className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] border-[7px] border-slate-900 bg-white shadow-[0_24px_70px_rgba(15,23,42,.18)]">
          <header className="border-b border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-[#06c755] font-bold text-white">
                W
              </div>
              <div>
                <h2 className="font-semibold">WLB Store</h2>
                <div className="flex items-center gap-1 text-xs text-emerald-700">
                  <span className="size-1.5 rounded-full bg-[#06c755]" />
                  ออนไลน์
                </div>
              </div>
            </div>
          </header>
          <div className="h-[470px] space-y-3 overflow-auto bg-[#f3f5f7] p-4">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`flex ${item.sender === "CUSTOMER" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[84%] rounded-2xl px-4 py-3 ${item.sender === "CUSTOMER" ? "rounded-br-sm bg-[#06c755] text-white" : "rounded-bl-sm border border-slate-200 bg-white"}`}
                >
                  <p className="whitespace-pre-wrap leading-6">{item.body}</p>
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${item.sender === "CUSTOMER" ? "text-emerald-100" : "text-slate-400"}`}
                  >
                    {item.time}
                    {item.sender === "CUSTOMER" && <CheckCheck size={13} />}
                  </div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-slate-400">
                  กำลังตอบ…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              className="control min-w-0 flex-1 px-3"
              placeholder="พิมพ์ข้อความ..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
            />
            <Button
              type="submit"
              disabled={!input.trim()}
              busy={busy}
              className="px-3"
              aria-label="ส่งข้อความ"
            >
              <Send size={18} />
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
