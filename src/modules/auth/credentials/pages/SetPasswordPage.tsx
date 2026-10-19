import { Placeholder } from "@/common/ui";

/* mode "reset": /reset-password (SH-02 step 2); mode "invite": /set-password (SH-03) */
export default function SetPasswordPage({ mode = "reset" }: { mode?: "reset" | "invite" }) {
  return <Placeholder title={mode === "invite" ? "Set your password" : "Reset password"} id="SH-02 / SH-03" />;
}
