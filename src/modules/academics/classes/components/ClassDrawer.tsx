import { useEffect, type FormEvent } from "react";
import { useApiMutation, useForm } from "@/common/hooks";
import { Alert, Button, Drawer, TextInput, Textarea, useToast } from "@/common/ui";
import { CLASSES_PATH, createClass, updateClass, type ClassInput, type SchoolClass } from "../api/classes";
import { classConflict } from "../utils/errors";

type Values = { className: string; classOrder: string; description: string };

/* Create (klass = null) or edit a class */
export function ClassDrawer({
  open,
  klass,
  nextOrder,
  onClose,
  onSaved
}: {
  open: boolean;
  klass: SchoolClass | null;
  nextOrder: number;
  onClose: () => void;
  onSaved?: (saved: SchoolClass) => void;
}) {
  const toast = useToast();
  const form = useForm<Values>({ className: "", classOrder: "", description: "" });
  const create = useApiMutation(createClass, { invalidate: [CLASSES_PATH] });
  const update = useApiMutation(updateClass, { invalidate: [CLASSES_PATH] });
  const { values } = form;

  useEffect(() => {
    if (open)
      form.reset(
        klass
          ? { className: klass.className, classOrder: String(klass.classOrder), description: klass.description ?? "" }
          : { className: "", classOrder: nextOrder <= 50 ? String(nextOrder) : "", description: "" }
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, klass?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    const order = Number(values.classOrder);
    const errors: Record<string, string> = {};
    if (!values.className.trim()) errors.className = "Enter a name, e.g. Class 1";
    if (!Number.isInteger(order) || order < 1 || order > 50) errors.classOrder = "A whole number from 1 to 50";
    form.setErrors(errors);
    if (Object.keys(errors).length) return;

    const body: ClassInput = { className: values.className.trim(), classOrder: order, description: values.description.trim() };
    const onError = (err: unknown) => {
      const fields = classConflict(err);
      if (fields) form.setErrors(fields);
      else form.setServerErrors(err);
    };
    const onSuccess = (res: { data: SchoolClass; message: string }) => {
      toast.success(res.message);
      onSaved?.(res.data);
      onClose();
    };

    if (!klass) {
      if (!body.description) delete body.description;
      create.mutate(body, { onSuccess, onError });
    } else {
      const patch: Partial<ClassInput> = {};
      if (body.className !== klass.className) patch.className = body.className;
      if (order !== klass.classOrder) patch.classOrder = order;
      if (body.description !== (klass.description ?? "")) patch.description = body.description;
      if (!Object.keys(patch).length) return onClose();
      update.mutate({ id: klass.id, ...patch }, { onSuccess, onError });
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={klass ? `Edit ${klass.className}` : "New class"}
      subtitle="Classes are school-wide and carry over to every year."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="class-form" variant="primary" loading={create.isPending || update.isPending}>
            {klass ? "Save changes" : "Create class"}
          </Button>
        </>
      }
    >
      <form id="class-form" className="stack" onSubmit={submit} noValidate>
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <TextInput label="Name" required maxLength={50} placeholder="Class 1" autoFocus {...form.text("className")} />
        <TextInput
          label="Order"
          type="number"
          required
          min={1}
          max={50}
          hint="Sorts the classes (1 is the youngest) and is used in student codes. Each class needs its own."
          {...form.text("classOrder")}
        />
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
