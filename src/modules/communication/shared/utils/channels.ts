import type { LucideIcon } from "lucide-react";
import { Mail, MessageSquareText, Smartphone } from "lucide-react";

/* Delivery channels. In-app is always on (every message lands in the inbox); email and SMS are
   delivered by background jobs. */
export const CHANNELS = ["IN_APP", "EMAIL", "SMS"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_META: Record<Channel, { label: string; icon: LucideIcon }> = {
  IN_APP: { label: "In-app", icon: MessageSquareText },
  EMAIL: { label: "Email", icon: Mail },
  SMS: { label: "SMS", icon: Smartphone }
};

export const SMS_COST_NOTE = "SMS is charged per message by your SMS provider; a long text counts as several messages.";

/* Who an announcement can go to (the API's audience roles) */
export const AUDIENCE_ROLES = ["ADMIN", "PRINCIPAL", "ACCOUNTANT", "STAFF", "TEACHER", "STUDENT", "PARENT"] as const;
export type AudienceRole = (typeof AUDIENCE_ROLES)[number];
