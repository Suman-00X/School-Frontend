import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";

/* The school's own Razorpay keys (BYOK, D-20). The secrets are write-only: reads show them
   masked ("****f9Qa"), and they are replaced as a set. */
export type PaymentSettings = {
  configured: boolean;
  provider: "razorpay";
  /* Where to point the Razorpay webhook (payment.captured, refund.*) */
  webhookUrl: string;
  /* The mock gateway (development): no real money moves */
  simulated: boolean;
  /* Only when configured */
  mode?: "test" | "live";
  keyId?: string;
  keySecret?: string | null;
  webhookSecret?: string | null;
  verifiedAt?: string | null;
  configuredBy?: string | null;
  updatedAt?: string;
};

export type KeysInput = { keyId: string; keySecret: string; webhookSecret: string };

export const PAYMENT_SETTINGS_PATH = "/finance/payment-settings";

export const usePaymentSettings = (enabled: boolean) => useApiGet<PaymentSettings>(PAYMENT_SETTINGS_PATH, undefined, { enabled });
export const saveKeys = (body: KeysInput) => api.put<PaymentSettings>(PAYMENT_SETTINGS_PATH, body);
export const removeKeys = () => api.delete<PaymentSettings>(PAYMENT_SETTINGS_PATH);
export const testConnection = () => api.post<PaymentSettings>(`${PAYMENT_SETTINGS_PATH}/connection-test`);

export const KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/;
