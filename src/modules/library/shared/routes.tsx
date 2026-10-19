import type { RouteObject } from "react-router-dom";
import { LibrarySetupLayout } from "./components/LibrarySetupLayout";

/* Library › Setup: its pages share one side list */
export const setupArea = (children: RouteObject[]): RouteObject => ({ element: <LibrarySetupLayout />, children });
