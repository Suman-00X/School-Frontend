import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { createFeeHead, FEE_HEADS_PATH, updateFeeHead, type FeeHead, type FeeHeadInput } from "../api/feeHeads";

type Values = { name: string; code: string; description: string };

const EMPTY: Values = { name: "", code: "", description: "" };

const CODE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;

/* FI-01 drawer: add (head = null), edit, or view a fee head (readers) */
export function FeeHeadDrawer({ open, head, canEdit, onClose }: { open: boolean; head: FeeHead | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useForm<Values>(EMPTY);
  const create = useApiMutation(createFeeHead, { invalidate: [FEE_HEADS_PATH] });
  const update = useApiMutation(updateFeeHead, { invalidate: [FEE_HEADS_PATH, "/finance/fee-structures", "/finance/concessions"] });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(head ? { name: head.name, code: head.code, description: head.description ?? "" } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, head?.id]);

  if (head && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={head.name} subtitle={<span className="mono">{head.code}</span>}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Name", value: head.name },
            { label: "Code", value: <span className="mono">{head.code}</span> },
            { label: "Description", value: head.description },
            { label: "Last changed", value: formatDateTime(head.updatedAt) }
          ]}
        />
      </Drawer>
    );

  const body = (): Partial<FeeHeadInput> => {
    const now = { name: values.name.trim(), code: values.code.trim().toUpperCase(), description: values.description.trim() };
    if (!head) return now.description ? now : { name: now.name, code: now.code };
    const out: Partial<FeeHeadInput> = {};
    if (now.name !== head.name) out.name = now.name;
    if (now.code !== head.code) out.code = now.code;
    if (now.description !== (head.description ?? "")) out.description = now.description;
    return out;
  };
  const changes = body();
  const dirty = Object.keys(changes).length > 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Enter a name, e.g. Tuition";
    if (!CODE.test(values.code.trim().toUpperCase())) e.code = "2–20 letters, digits, - or _";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  /* 409: the code or name is taken; the message says which */
  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409) {
      form.setErrors({ [/code/i.test(err.message) ? "code" : "name"]: err.message });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate() || !dirty) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (head) update.mutate({ id: head.id, ...changes }, { onSuccess: done, onError });
    else create.mutate(changes as FeeHeadInput, { onSuccess: done, onError });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={head ? head.name : "New fee head"}
      subtitle={head ? undefined : "What a fee is for: tuition, transport, exams…"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="fee-head-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!head && !dirty}>
            {head ? "Save changes" : "Add fee head"}
          </Button>
        </>
      }
    >
      <form id="fee-head-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus maxLength={100} placeholder="Tuition" {...form.text("name")} />
          <TextInput
            label="Code"
            required
            maxLength={20}
            placeholder="TUI"
            className="mono"
            hint="Short and unique, shown on invoices"
            {...form.text("code")}
            onChange={e => form.set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
            error={errors.code}
          />
        </div>
        <Textarea label="Description" rows={3} maxLength={1000} {...form.text("description")} />
        <p className="small muted">Each fee head gets its own income account in the ledger the first time money is posted to it.</p>
      </form>
    </Drawer>
  );
}
