import { createSmartReply } from "@/lib/automation";
import { sql } from "@/lib/db";

export type RuleSet = {
  autoFaq: boolean;
  autoLead: boolean;
  notifyUnknown: boolean;
  notifyIntent: boolean;
  intentKeywords: string[];
};

export async function loadRuleSet(): Promise<RuleSet> {
  const rows = await sql`SELECT rule_key,enabled,value FROM automation_rules` as { rule_key: string; enabled: boolean; value: string | null }[];
  const map = new Map(rows.map((row) => [row.rule_key, row]));
  const enabled = (key: string) => map.get(key)?.enabled ?? false;
  return {
    autoFaq: enabled("auto_faq"),
    autoLead: enabled("auto_lead"),
    notifyUnknown: enabled("notify_unknown"),
    notifyIntent: enabled("notify_intent"),
    intentKeywords: (map.get("notify_intent")?.value ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
  };
}

export async function evaluateAutomation(input: string, rules: RuleSet) {
  const faqRows = rules.autoFaq
    ? await sql`SELECT question,answer,keywords FROM faqs WHERE active=TRUE` as { question: string; answer: string; keywords: unknown }[]
    : [];
  return evaluateAutomationWithRules(input, rules, faqRows.map((row) => ({
    question: row.question,
    answer: row.answer,
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
  })));
}

export function evaluateAutomationWithRules(input: string, rules: RuleSet, faqs: Array<{ question: string; answer: string; keywords: string[] }> = []) {
  const smart = createSmartReply(input, faqs, { faqEnabled: rules.autoFaq });
  const normalized = input.toLowerCase();
  return {
    ...smart,
    shouldCreateLead: rules.autoLead && smart.shouldCreateLead,
    notifyUnknown: rules.notifyUnknown && smart.intent === "UNKNOWN",
    notifyIntent: rules.notifyIntent && rules.intentKeywords.some((keyword) => normalized.includes(keyword)),
    shouldReply: smart.intent !== "UNKNOWN" || rules.notifyUnknown,
    needsAdmin: smart.intent === "HANDOFF" || (smart.intent === "UNKNOWN" && rules.notifyUnknown),
  };
}
