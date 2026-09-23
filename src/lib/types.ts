export type ConversationStatus = "AUTO" | "ADMIN" | "WAITING" | "CLOSED";
export type LeadStatus = "NEW" | "CONTACTED" | "INTERESTED" | "WON" | "LOST";

export interface Customer {
  id: number;
  lineUserId: string;
  displayName: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  interestedProduct: string | null;
  color: string | null;
  size: string | null;
  pictureUrl: string | null;
  language: string | null;
  profileSyncedAt: string | null;
  followedAt: string | null;
  unfollowedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  sender: "CUSTOMER" | "SYSTEM" | "ADMIN";
  body: string;
  messageType: string;
  deliveryStatus: "RECEIVED" | "QUEUED" | "SENDING" | "SENT" | "FAILED";
  payload: Record<string, unknown>;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  lastErrorCode: string | null;
  internal: boolean;
  createdAt: string;
}

export interface Conversation {
  id: number;
  status: ConversationStatus;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  customer: Customer;
  messages: Message[];
}

export interface Lead {
  id: number;
  customerId: number;
  customerName: string;
  product: string;
  phone: string | null;
  status: LeadStatus;
  source: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  color: string | null;
  size: string | null;
}

export interface FAQ { id: number; question: string; answer: string; keywords: string[]; active: boolean; updatedAt: string }
export interface Product { id: number; name: string; price: number; colors: string[]; sizes: string[]; stock: number; active: boolean }
export interface AutomationRule { id: number; key: string; label: string; description: string; enabled: boolean; value: string | null }
export interface Notification { id: number; type: string; title: string; body: string; read: boolean; createdAt: string; conversationId: number | null; leadId: number | null; referenceType: string | null; referenceId: string | null }
export interface Settings { storeName: string; phone: string; welcomeMessage: string; demoMode: boolean; channelId: string; hasChannelSecret: boolean; hasAccessToken: boolean; webhookUrl: string; businessTimezone: string; businessHours: Record<string, [string, string]>; awayMessage: string; outsideHoursBot: boolean }

export interface AppState {
  summary: { conversations: number; newLeads: number; waiting: number; won: number };
  conversations: Conversation[];
  customers: Customer[];
  leads: Lead[];
  faqs: FAQ[];
  products: Product[];
  automationRules: AutomationRule[];
  notifications: Notification[];
  settings: Settings;
}
