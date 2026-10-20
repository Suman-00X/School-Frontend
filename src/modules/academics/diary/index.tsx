import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import DiaryPage from "./pages/DiaryPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/academics/diary", element: <RequirePermission permission="academics.diary.read"><DiaryPage /></RequirePermission> }
];

/* A day's lines and the date picker, for the portal (PO-15) */
export { DiaryLines, DateNav, NoLines } from "./components/DiaryLines";
export { dayLabel, shiftDate, type DiaryEntry, type DiaryHomework, type DiarySignature } from "./api/diary";
