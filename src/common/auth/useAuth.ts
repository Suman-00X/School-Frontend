import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./AuthProvider";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/* Permission checks for buttons and menu items: can("users.accounts.update") */
export function useCan() {
  const { can, canAny, isOwner } = useAuth();
  return { can, canAny, isOwner };
}
