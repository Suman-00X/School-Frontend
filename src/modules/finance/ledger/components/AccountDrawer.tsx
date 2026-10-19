import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Select, Switch, TextInput, Textarea, useToast } from "@/common/ui";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_HINTS,
  ACCOUNT_TYPE_LABELS,
  createAccount,
  updateAccount,
  useLedgerMutation,
  type AccountInput,
  type AccountType,
  type LedgerAccount
} from "../api/ledger";

type Values = { code: string; name: string; accountType: AccountType | ""; isContra: boolean; description: string };
const EMPTY: Values = { code: "", name: "", accountType: "", isContra: false, description: "" };
const CODE = /^[0-9A-Z][0-9A-Z.-]{1,19}$/;

/* FI-13 account drawer: add an account, or rename one / edit its description (code and type are fixed) */
export function AccountDrawer({ open, account, canEdit, onClose }: { open: boolean; account: LedgerAccount | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useForm<Values>(EMPTY);
  const create = useLedgerMutation(createAccount);
  const update = useLedgerMutation(updateAccount);
  const { values, errors } = form;

  useEffect(() => {
    if (open)
      form.reset(
        account
          ? { code: account.code, name: account.name, accountType: account.accountType, isContra: account.isContra, description: account.description ?? "" }
          : EMPTY
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id]);

  const fixed = account && (
    <DescriptionList
      items={[
        { label: "Code", value: <span className="mono">{account.code}</span> },
        { label: "Type", value: ACCOUNT_TYPE_LABELS[account.accountType] },
        { label: "Normal balance", value: account.normalBalance === "DEBIT" ? "Debit" : "Credit" },
        { label: "Kind", value: account.isSystem ? <Badge tone="info">System account</Badge> : "Added by the school" },
        { label: "Contra account", value: account.isContra ? "Yes" : "No", hidden: !account.isContra },
        { label: "Fee head", value: account.feeHead?.name, hidden: !account.feeHead }
      ]}
    />
  );

  if (account && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={`${account.code} ${account.name}`}>
        <div className="stack">
          {fixed}
          <DescriptionList columns={1} items={[{ label: "Description", value: account.description }]} />
        </div>
      </Drawer>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    const errs: Record<string, string> = {};
    if (!values.name.trim()) errs.name = "Enter a name, e.g. Electricity";
    if (!account) {
      if (!CODE.test(values.code.trim().toUpperCase())) errs.code = "2–20 letters, digits, . or -";
      if (!values.accountType) errs.accountType = "Pick a type";
    }
    if (Object.keys(errs).length) {
      form.setErrors(errs);
      return;
    }
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    const onError = (err: unknown) => {
      if (isApiError(err) && err.status === 409) {
        form.setErrors({ [/code/i.test(err.message) ? "code" : "name"]: err.message });
        form.setFormError(null);
      } else form.setServerErrors(err);
    };
    if (account) {
      const body: { id: string; name?: string; description?: string } = { id: account.id };
      if (values.name.trim() !== account.name) body.name = values.name.trim();
      if (values.description.trim() !== (account.description ?? "")) body.description = values.description.trim();
      if (Object.keys(body).length === 1) return onClose();
      update.mutate(body, { onSuccess: done, onError });
    } else {
      const body: AccountInput = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        accountType: values.accountType as AccountType,
        ...(values.isContra ? { isContra: true } : {}),
        ...(values.description.trim() ? { description: values.description.trim() } : {})
      };
      create.mutate(body, { onSuccess: done, onError });
    }
  };

  const dirty = !account || values.name.trim() !== account.name || values.description.trim() !== (account.description ?? "");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={account ? `${account.code} ${account.name}` : "New account"}
      subtitle={account ? undefined : "An account of the school's own, such as an expense or a grant."}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="ledger-account-form" variant="primary" loading={create.isPending || update.isPending} disabled={!dirty}>
            {account ? "Save changes" : "Add account"}
          </Button>
        </>
      }
    >
      <form id="ledger-account-form" className="stack" onSubmit={submit} noValidate>
        {account ? (
          fixed
        ) : (
          <div className="form-grid">
            <TextInput
              label="Code"
              required
              maxLength={20}
              placeholder="5430"
              className="mono"
              hint="Can't be changed later"
              {...form.text("code")}
              onChange={e => form.set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
              error={errors.code}
            />
            <Select
              label="Type"
              required
              value={values.accountType}
              placeholder="Pick a type"
              error={errors.accountType}
              hint="Can't be changed later"
              options={ACCOUNT_TYPES.map(t => ({ value: t, label: ACCOUNT_TYPE_LABELS[t], description: ACCOUNT_TYPE_HINTS[t] }))}
              onChange={e => form.set("accountType", e.target.value as AccountType)}
            />
          </div>
        )}
        <TextInput label="Name" required autoFocus maxLength={120} placeholder="Electricity" {...form.text("name")} />
        {!account && (
          <Switch
            label="Contra account: carries the opposite balance of its type"
            checked={values.isContra}
            onChange={v => form.set("isContra", v)}
          />
        )}
        <Textarea label="Description" rows={3} maxLength={500} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
