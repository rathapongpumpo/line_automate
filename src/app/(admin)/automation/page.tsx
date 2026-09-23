"use client";
import { Bot, MessageSquareText, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { Button, Spinner, useToast } from "@/components/ui";
import { useAppState } from "@/hooks/use-app-state";
export default function AutomationPage() {
  const { data, loading, refresh } = useAppState();
  const toast = useToast();
  const [welcome, setWelcome] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function toggle(id: number, enabled: boolean, value?: string | null) {
    const response = await fetch("/api/automation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled, value }),
    });
    if (response.ok) {
      toast("อัปเดต Automation แล้ว");
      await refresh();
    } else toast("อัปเดตไม่สำเร็จ", "error");
  }
  async function saveWelcome() {
    if (!data) return;
    setBusy(true);
    const s = data.settings;
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeName: s.storeName,
        phone: s.phone,
        welcomeMessage: welcome ?? s.welcomeMessage,
        demoMode: s.demoMode,
        businessTimezone: s.businessTimezone,
        businessHours: s.businessHours,
        awayMessage: s.awayMessage,
        outsideHoursBot: s.outsideHoursBot,
      }),
    });
    setBusy(false);
    if (response.ok) {
      toast("บันทึกข้อความต้อนรับแล้ว");
      await refresh();
    } else toast("บันทึกไม่สำเร็จ", "error");
  }
  if (loading || !data) return <Spinner />;
  const icons = [MessageSquareText, Zap, ShieldCheck, Bot];
  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="page-title">Automation</h1>
      <p className="mt-2 text-slate-500">
        เปิดใช้กฎตอบกลับและแจ้งเตือนแบบง่ายสำหรับร้านของคุณ
      </p>
      <section className="panel mt-6 divide-y divide-slate-100 overflow-hidden">
        {data.automationRules.map((rule, index) => {
          const Icon = icons[index] ?? Bot;
          return (
            <div key={rule.id} className="flex items-start gap-4 p-5">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100">
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{rule.label}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {rule.description}
                </p>
                {rule.value && (
                  <input
                    className="control mt-3 w-full max-w-md px-3"
                    defaultValue={rule.value}
                    onBlur={(e) =>
                      void toggle(rule.id, rule.enabled, e.target.value)
                    }
                  />
                )}
              </div>
              <button
                role="switch"
                aria-checked={rule.enabled}
                aria-label={`${rule.enabled ? "ปิด" : "เปิด"} ${rule.label}`}
                onClick={() => void toggle(rule.id, !rule.enabled, rule.value)}
                className={`relative mt-1 h-7 w-12 rounded-full transition-colors ${rule.enabled ? "bg-[#06c755]" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform ${rule.enabled ? "translate-x-5" : ""}`}
                />
              </button>
            </div>
          );
        })}
      </section>
      <section className="panel mt-6 p-5">
        <h2 className="text-lg font-semibold">ข้อความต้อนรับ</h2>
        <p className="mt-1 text-sm text-slate-500">
          ส่งเมื่อลูกค้าเริ่มคุยกับร้านครั้งแรก
        </p>
        <textarea
          rows={6}
          className="control mt-4 w-full resize-none px-3 py-3 leading-6"
          value={welcome ?? data.settings.welcomeMessage}
          onChange={(e) => setWelcome(e.target.value)}
        />
        <div className="mt-4 flex justify-end">
          <Button busy={busy} onClick={saveWelcome}>
            บันทึกข้อความ
          </Button>
        </div>
      </section>
    </div>
  );
}
