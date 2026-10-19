import type { FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Card, FormActions, PasswordChecklist, PasswordInput, passwordOk, useToast } from "@/common/ui";
import { formatWait, retryAfterSeconds, useCooldown } from "../../shared/hooks/useCooldown";
import { changePassword } from "../../credentials/api/passwords";
import { SESSIONS_PATH } from "../../sessions/api/sessions";

const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

export function PasswordCard() {
  const toast = useToast();
  const form = useForm(EMPTY);
  const cooldown = useCooldown();
  const mutation = useApiMutation(changePassword, { invalidate: [SESSIONS_PATH] });
  const { currentPassword, newPassword, confirm } = form.values;
  const mismatch = confirm.length > 0 && confirm !== newPassword;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    mutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: res => {
          toast.success(res.message);
          form.reset(EMPTY);
        },
        onError: err => {
          if (!isApiError(err)) return form.setServerErrors(err);
          if (err.status === 422) {
            const field = /current password/i.test(err.message) ? "currentPassword" : "newPassword";
            form.setErrors({ [field]: err.message });
          } else if (err.status === 429) {
            cooldown.start(retryAfterSeconds(err));
            form.setFormError(err.message);
          } else form.setServerErrors(err);
        }
      }
    );
  };

  const waiting = cooldown.secondsLeft > 0;
  return (
    <Card title="Password" subtitle="Changing it signs out your other devices.">
      <form className="stack" onSubmit={submit} noValidate>
        <PasswordInput label="Current password" required maxLength={128} autoComplete="current-password" {...form.text("currentPassword")} />
        <div className="stack-sm">
          <PasswordInput label="New password" required maxLength={128} autoComplete="new-password" {...form.text("newPassword")} />
          <PasswordChecklist password={newPassword} />
        </div>
        <PasswordInput
          label="Confirm new password"
          required
          maxLength={128}
          autoComplete="new-password"
          {...form.text("confirm")}
          error={mismatch ? "The passwords don't match" : undefined}
        />
        {/* Success is a toast; an error takes the start of this bar (nothing is inserted above the form) */}
        <FormActions error={form.formError}>
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={waiting || !currentPassword || !passwordOk(newPassword) || confirm !== newPassword}
          >
            {waiting ? `Try again in ${formatWait(cooldown.secondsLeft)}` : "Change password"}
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}
