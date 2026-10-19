import type { FormEvent } from "react";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, useToast } from "@/common/ui";
import { patchFrom } from "@/modules/users/shared";
import {
  STUDENT_PROFILE_TEXT_KEYS,
  studentProfileFrom,
  updateStudent,
  validateStudentProfile,
  type Student
} from "../api/students";
import { StudentProfileFields } from "./StudentProfileFields";

/* Profile fields only; name, email and phone are on the account (AD-06). Mount it while open. */
export function EditStudentDrawer({ student, onClose }: { student: Student; onClose: () => void }) {
  const toast = useToast();
  const original = studentProfileFrom(student);
  const form = useForm(original);
  const save = useApiMutation(updateStudent, { invalidate: ["/users/students"] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors = validateStudentProfile(form.values);
    const { body, errors: clearErrors } = patchFrom(original, form.values, STUDENT_PROFILE_TEXT_KEYS);
    Object.assign(errors, clearErrors);
    if (Object.keys(errors).length) return form.setErrors(errors);
    if (!Object.keys(body).length) return onClose();
    save.mutate(
      { studentId: student.id, ...body },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit student"
      subtitle={<span className="mono">{student.studentCode}</span>}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="edit-student" variant="primary" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-student" className="stack" onSubmit={submit} noValidate>
        <StudentProfileFields form={form} disabled={save.isPending} admissionNumber={student.admissionNumber} />
      </form>
    </Drawer>
  );
}
