import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Button, ButtonLink, Card, FormActions, Page, useToast } from "@/common/ui";
import { PERSON_KEYS, PersonFields, emptyPerson, nestedFieldMap, personPayload, useSchoolCurrency, validatePerson } from "@/modules/users/shared";
import { createParent } from "../api/parents";
import { ParentProfileFields } from "../components/ParentProfileFields";
import { PARENT_PROFILE_KEYS, emptyParentProfile, parentProfilePayload, validateParentProfile } from "../utils/profile";

/* PE-04: new parent (account + profile). Linking to a student happens on the student's profile. */
export default function NewParentPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const currency = useSchoolCurrency();
  const person = useForm(emptyPerson());
  const profile = useForm(emptyParentProfile());
  const create = useApiMutation(createParent, { invalidate: ["/users"] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const personErrors = validatePerson(person.values);
    const profileErrors = validateParentProfile(profile.values);
    person.setErrors(personErrors);
    profile.setErrors(profileErrors);
    person.setFormError(null);
    if (Object.keys(personErrors).length || Object.keys(profileErrors).length) return;
    create.mutate(
      { user: personPayload(person.values), profile: parentProfilePayload(profile.values) },
      {
        onSuccess: res => {
          toast.success(res.message);
          navigate(`/users/parents?parent=${res.data.id}`);
        },
        onError: err => {
          if (isApiError(err) && err.status === 409 && /email/i.test(err.message)) {
            person.setErrors({ email: err.message });
            return;
          }
          person.setServerErrors(err, nestedFieldMap("user", PERSON_KEYS));
          if (isApiError(err) && err.isValidation) profile.setServerErrors(err, nestedFieldMap("profile", PARENT_PROFILE_KEYS));
        }
      }
    );
  };

  return (
    <Page>
      <DrillHeader back="/users/parents" backLabel="Back to parents" title="New parent" />
      <form className="stack" onSubmit={submit} noValidate style={{ maxWidth: 820 }}>
        <Card title="Personal details" subtitle="Creates the parent's account. Send an invitation afterwards so they can set a password.">
          <PersonFields form={person} disabled={create.isPending} emailHint="Used to sign in and for invitations" />
        </Card>
        <Card title="Profile">
          <ParentProfileFields form={profile} currency={currency} disabled={create.isPending} />
        </Card>
        <FormActions error={person.formError}>
          <ButtonLink to="/users/parents">Cancel</ButtonLink>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create parent
          </Button>
        </FormActions>
      </form>
    </Page>
  );
}
