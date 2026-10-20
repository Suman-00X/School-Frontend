import { useSyncExternalStore } from "react";
import { operatorSession } from "../api/session";

/* The signed-in operator, or null; re-renders when the session starts or ends (any tab) */
export const useOperator = () => useSyncExternalStore(operatorSession.subscribe, operatorSession.get, () => null);
