import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AcademicYear } from "@/common/api";
import { CalendarRange, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Alert, Button, ButtonLink, Card, EmptyState, Page, PageHeader, PageLoader, Stepper, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { PersonFields, emptyPerson, personPayload, validatePerson } from "@/modules/users/shared";
import type { Parent } from "@/modules/users/parents";
import { STUDENTS_PATH, admitStudent, emptyStudentProfile, validateStudentProfile, type AdmissionResult, type Student } from "../api/students";
import { useSections } from "../api/placement";
import { StudentProfileFields } from "../components/StudentProfileFields";
import { ParentsStep } from "../components/admission/ParentsStep";
import { EnrollmentStep } from "../components/admission/EnrollmentStep";
import { ReviewStep } from "../components/admission/ReviewStep";
import { AdmissionSuccess } from "../components/admission/AdmissionSuccess";
import { STEPS, cardsPayload, routeAdmissionError, validateCards, type EnrollmentValues, type ParentCard } from "../components/admission/state";

/* PE-03: student → parents → enrollment → review, then one POST (a single transaction) */
export default function AdmissionWizardPage() {
  /* "Admit another" starts over with a fresh wizard */
  const [run, setRun] = useState(0);
  return <AdmissionWizard key={run} onAnother={() => setRun(r => r + 1)} />;
}

function AdmissionWizard({ onAnother }: { onAnother: () => void }) {
  const { years: allYears, current, isLoading: yearsLoading, canSwitch: canReadYears } = useAcademicYear();
  const years = allYears.filter(y => !y.archivedAt);
  const defaultYear = (current && !current.archivedAt ? current : years[0]) ?? null;
  /* Prerequisite: the default year has at least one section */
  const prereq = useSections(null, defaultYear?.id, !!defaultYear);

  if (yearsLoading || (defaultYear && prereq.isLoading)) return <PageLoader />;
  const ready = !!defaultYear && (prereq.data?.total ?? 0) > 0;

  return (
    <Page>
      <PageHeader title="Admit a student" breadcrumbs={[{ label: "Students", to: "/users/students" }, { label: "Admit" }]} />
      {ready ? (
        <Wizard years={years} defaultYearId={defaultYear!.id} onAnother={onAnother} />
      ) : (
        <Card>
          <EmptyState
            icon={<CalendarRange />}
            title="Set up the academic year and its sections first"
            message={
              !canReadYears
                ? "Admission needs read access to academic years, classes and sections."
                : defaultYear
                  ? `${defaultYear.yearName} has no sections yet. A student is admitted into a section.`
                  : "There is no open academic year. A student is admitted into a section of a year."
            }
            actions={
              <>
                <ButtonLink to="/academics/academic-years" icon={<CalendarRange />}>
                  Academic years
                </ButtonLink>
                <ButtonLink to="/academics/classes" icon={<Layers />}>
                  Classes and sections
                </ButtonLink>
              </>
            }
          />
        </Card>
      )}
    </Page>
  );
}

function Wizard({ years, defaultYearId, onAnother }: { years: AcademicYear[]; defaultYearId: string; onAnother: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const person = useForm(emptyPerson());
  const profile = useForm({ ...emptyStudentProfile(), admissionDate: todayIso() });
  const [cards, setCards] = useState<ParentCard[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentValues>({ academicYearId: defaultYearId, classId: "", sectionId: "", admissionType: "NEW" });
  const [enrollmentErrors, setEnrollmentErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AdmissionResult | null>(null);
  const admit = useApiMutation(admitStudent, { invalidate: ["/users", "/academics/enrollments"] });

  const go = (to: number) => {
    setMessage(null);
    setStep(to);
    window.scrollTo({ top: 0 });
  };

  /* Next runs the step's own checks before moving on */
  const validateStep = (s: number): boolean => {
    if (s === 0) {
      const pe = validatePerson(person.values);
      const pr = validateStudentProfile(profile.values);
      person.setErrors(pe);
      profile.setErrors(pr);
      return !Object.keys(pe).length && !Object.keys(pr).length;
    }
    if (s === 1) {
      const checked = validateCards(cards, person.values.email);
      setCards(checked.cards);
      return checked.ok;
    }
    if (s === 2) {
      const e: Record<string, string> = {};
      if (!enrollment.academicYearId) e.academicYearId = "is required";
      if (!enrollment.classId) e.classId = "is required";
      if (!enrollment.sectionId) e.sectionId = "is required";
      setEnrollmentErrors(e);
      return !Object.keys(e).length;
    }
    return true;
  };

  const next = () => {
    if (validateStep(step)) go(step + 1);
    else setMessage("Please correct the highlighted fields.");
  };

  const submit = () => {
    for (let s = 0; s < 3; s++)
      if (!validateStep(s)) {
        setStep(s);
        setMessage("Please correct the highlighted fields.");
        return;
      }
    admit.mutate(
      {
        user: personPayload(person.values),
        profile: Object.fromEntries(Object.entries(profile.values).filter(([, v]) => v.trim() !== "")),
        parents: cardsPayload(cards),
        enrollment: { academicYearId: enrollment.academicYearId, sectionId: enrollment.sectionId, admissionType: enrollment.admissionType }
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          setResult(res.data);
        },
        onError: err => {
          /* Emails already loaded here (pickers) help tell whose email a 409 is about */
          const cached = <T,>(key: string) => queryClient.getQueryData<{ rows: T[] }>([key, "all"])?.rows ?? [];
          const r = routeAdmissionError(err, {
            studentEmail: person.values.email,
            cards,
            knownStudentEmails: new Set(cached<Student>(STUDENTS_PATH).map(s => s.user.email.toLowerCase())),
            knownParentEmails: new Set(cached<Parent>("/users/parents").map(p => p.user.email.toLowerCase()))
          });
          person.setErrors(r.person);
          profile.setErrors(r.profile);
          setEnrollmentErrors(r.enrollment);
          setCards(cs => cs.map((c, i) => (r.cards[i] ? { ...c, errors: { ...c.errors, ...r.cards[i].errors }, error: r.cards[i].error } : c)));
          setStep(r.step);
          setMessage(r.message);
        }
      }
    );
  };

  if (result) return <AdmissionSuccess result={result} onAnother={onAnother} />;

  return (
    <div className="stack">
      <Stepper steps={STEPS} current={step} onStepClick={go} />
      {message && <Alert tone="danger">{message}</Alert>}

      {step === 0 && (
        <>
          <Card title="Student details">
            <PersonFields form={person} emailHint="The student signs in with this email" />
          </Card>
          <Card title="Admission">
            <StudentProfileFields form={profile} />
          </Card>
        </>
      )}
      {step === 1 && <ParentsStep cards={cards} onChange={setCards} />}
      {step === 2 && (
        <Card title="Enrollment">
          <EnrollmentStep
            years={years}
            values={enrollment}
            errors={enrollmentErrors}
            onChange={change => {
              setEnrollment(v => ({ ...v, ...change }));
              setEnrollmentErrors({});
            }}
          />
        </Card>
      )}
      {step === 3 && <ReviewStep person={person.values} profile={profile.values} cards={cards} enrollment={enrollment} years={years} onEdit={go} />}

      <div className="form-actions">
        {step > 0 ? (
          <Button icon={<ChevronLeft />} onClick={() => go(step - 1)} disabled={admit.isPending}>
            Back
          </Button>
        ) : (
          <ButtonLink to="/users/students">Cancel</ButtonLink>
        )}
        {step === 1 && cards.length === 0 && (
          <Button variant="ghost" onClick={() => go(2)}>
            Skip
          </Button>
        )}
        {step < 3 ? (
          <Button variant="primary" onClick={next}>
            Next <ChevronRight size={16} />
          </Button>
        ) : (
          <Button variant="primary" loading={admit.isPending} onClick={submit}>
            Admit student
          </Button>
        )}
      </div>
    </div>
  );
}
