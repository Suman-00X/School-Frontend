import { Select } from "@/common/ui";
import { useSectionOptions } from "./SectionSelect";
import "./setup.css";

/* A class, then one of its sections, from ?class= and ?section=. Only classes with sections in
   the header's year (for a teacher: the ones they teach in). An old link may name only the
   section; with no section picked, the class's first one is. */
export function useClassSectionPick(classParam: string, sectionParam: string) {
  const { sections, byId, isLoading } = useSectionOptions();
  /* Sections come in class order, so classes do too */
  const classes = sections.reduce<{ id: string; name: string }[]>(
    (out, s) => (out.some(c => c.id === s.classId) ? out : [...out, { id: s.classId, name: s.class?.className ?? "Class" }]),
    []
  );
  const classId = classParam || byId.get(sectionParam)?.classId || "";
  const classSections = sections.filter(s => s.classId === classId);
  const sectionId = classSections.some(s => s.id === sectionParam) ? sectionParam : (classSections[0]?.id ?? "");
  return { classes, classId, className: classes.find(c => c.id === classId)?.name, classSections, sectionId, isLoading };
}

export type ClassSectionPick = ReturnType<typeof useClassSectionPick>;

/* The class dropdown with the class's sections as tabs beside it (for a filter bar) */
export function ClassSectionPicker({ pick, onPick }: { pick: ClassSectionPick; onPick: (classId: string, sectionId: string) => void }) {
  const { classes, classId, className, classSections, sectionId, isLoading } = pick;
  return (
    <>
      <Select
        label="Class"
        searchable
        value={classId}
        onChange={e => onPick(e.target.value, "")}
        options={classes.map(c => ({ value: c.id, label: c.name }))}
        placeholder={isLoading ? "Loading classes…" : "Pick a class"}
      />
      {classSections.length > 0 && (
        <div className="field section-tabs-field">
          <span className="field-label">Section</span>
          <div className="section-tabs" role="tablist" aria-label={`Sections of ${className}`}>
            {classSections.map(s => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === sectionId}
                className={`section-tab${s.id === sectionId ? " active" : ""}`}
                onClick={() => onPick(classId, s.id)}
              >
                {s.sectionName}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
