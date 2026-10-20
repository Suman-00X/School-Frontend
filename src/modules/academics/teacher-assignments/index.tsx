import { Navigate, useSearchParams, type RouteObject } from "react-router-dom";

/* Teacher assignments now live in Academics › Setup › Curriculum: section by section on its
   Curriculum tab, a teacher's on its Teacher tab. Old links land on the matching one. */
function ToCurriculum() {
  const [params] = useSearchParams();
  const teacher = params.get("teacher");
  const section = params.get("section");
  const next = new URLSearchParams();
  if (teacher || params.get("view") === "teacher") {
    next.set("tab", "teacher");
    if (teacher) next.set("teacher", teacher);
  } else if (section) next.set("section", section);
  const query = next.toString();
  return <Navigate to={`/academics/curriculum${query ? `?${query}` : ""}`} replace />;
}

export const routes: RouteObject[] = [{ path: "/academics/teacher-assignments", element: <ToCurriculum /> }];
