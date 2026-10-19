/* Razorpay Checkout, loaded only when someone pays (never on page load) */

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (res: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean };
};

type RazorpayInstance = { open: () => void; on: (event: "payment.failed", fn: (res: { error?: { description?: string } }) => void) => void };
type RazorpayCtor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loading: Promise<RazorpayCtor> | null = null;

export function loadRazorpay(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise<RazorpayCtor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("checkout")));
    script.onerror = () => {
      script.remove();
      reject(new Error("checkout"));
    };
    document.head.appendChild(script);
  }).catch(e => {
    loading = null;
    throw e;
  });
  return loading;
}

/* Opens the checkout and settles when it closes: the gateway's signed result, or null when
   the person closed it. A failed attempt inside the checkout lets them retry there. */
export async function openCheckout(options: Omit<RazorpayOptions, "handler" | "modal">): Promise<RazorpaySuccess | null> {
  const Razorpay = await loadRazorpay();
  return new Promise(resolve => {
    const rzp = new Razorpay({
      ...options,
      handler: res => resolve(res),
      modal: { ondismiss: () => resolve(null), escape: true }
    });
    rzp.open();
  });
}
