import { Users } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList } from "@/common/hooks";
import { Badge, ButtonLink, Card, EmptyState, Page, PageHeader, SkeletonBlock } from "@/common/ui";
import { PortalError } from "../../shared/components/PortalError";
import { TEACHING_SECTIONS_PATH, type Subject, type TeachingSection } from "../api/learning";
import { sectionLinks } from "../utils/sectionLinks";
import "../../shared/portal.css";

/* PO-10 · My sections: the sections a teacher teaches this year, their role in each, the
   subjects they take there, and the work pages for the section */
export default function TeachingSectionsPage() {
  const { can } = useAuth();
  const sections = useApiGet<TeachingSection[]>(TEACHING_SECTIONS_PATH);
  /* Gap: the sections only carry subject ids */
  const subjects = useApiList<Subject>("/academics/subjects", { limit: 100 }, { enabled: can("academics.subjects.read") });
  const subjectName = (id: string) => subjects.rows?.find(s => s.id === id)?.subjectName;

  const noProfile = isApiError(sections.error) && sections.error.status === 404;
  const list = [...(sections.data ?? [])].sort((a, b) => Number(b.isClassTeacher) - Number(a.isClassTeacher) || a.section.localeCompare(b.section, undefined, { numeric: true }));

  return (
    <Page>
      <PageHeader title="My sections" subtitle="The classes you teach this year" />
      {noProfile ? (
        <EmptyState icon={<Users />} title="Your account has no teacher profile" message="Contact the office." />
      ) : sections.error ? (
        <PortalError error={sections.error} onRetry={() => void sections.refetch()} />
      ) : !sections.data ? (
        <div className="po-section-cards">
          {[0, 1, 2].map(i => (
            <Card key={i}>
              <SkeletonBlock lines={4} />
            </Card>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<Users />} title="You have no sections assigned this year" message="The office assigns teachers to sections and subjects." />
        </Card>
      ) : (
        <div className="po-section-cards">
          {list.map(s => {
            const links = sectionLinks(s, can);
            return (
              <Card
                key={s.sectionId}
                title={s.section}
                actions={s.isClassTeacher ? <Badge tone="primary">Class teacher</Badge> : s.isDeputyClassTeacher ? <Badge tone="info">Deputy class teacher</Badge> : undefined}
              >
                <div className="stack-sm">
                  <div className="po-chips" style={{ minHeight: 24 }}>
                    {s.subjectIds.length ? (
                      s.subjectIds.map(id => <Badge key={id}>{subjectName(id) ?? (subjects.isLoading ? "…" : "Subject")}</Badge>)
                    ) : (
                      <span className="small muted">{s.isClassTeacher || s.isDeputyClassTeacher ? "No subjects of your own here" : "No subjects"}</span>
                    )}
                  </div>
                  {links.length > 0 && (
                    <div className="po-section-links" style={{ marginTop: 6 }}>
                      {links.map(l => (
                        <ButtonLink key={l.label} size="sm" to={l.to}>
                          {l.label}
                        </ButtonLink>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
