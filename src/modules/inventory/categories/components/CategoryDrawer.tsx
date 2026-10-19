import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, TextInput, Textarea, useToast } from "@/common/ui";
import { CATEGORIES_PATH, createCategory, updateCategory, type Category } from "../api/categories";

type Values = { name: string; description: string };

/* IN-01 drawer: add (category = null) or view / rename one */
export function CategoryDrawer({ open, category, canEdit, onClose }: { open: boolean; category: Category | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useForm<Values>({ name: "", description: "" });
  const create = useApiMutation(createCategory, { invalidate: [CATEGORIES_PATH] });
  const update = useApiMutation(updateCategory, { invalidate: [CATEGORIES_PATH, "/inventory/items"] });

  useEffect(() => {
    if (open) form.reset({ name: category?.name ?? "", description: category?.description ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.id]);

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409) {
      form.setErrors({ name: err.message });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };
  const done = (res: { message: string }) => {
    toast.success(res.message);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    const name = form.values.name.trim();
    const description = form.values.description.trim();
    if (!name) return form.setErrors({ name: "Enter a name" });
    if (!category) return create.mutate(description ? { name, description } : { name }, { onSuccess: done, onError });
    const changes: { name?: string; description?: string } = {};
    if (name !== category.name) changes.name = name;
    /* "" clears the description (the API refuses null) */
    if (description !== (category.description ?? "")) changes.description = description;
    if (!Object.keys(changes).length) return onClose();
    update.mutate({ id: category.id, ...changes }, { onSuccess: done, onError });
  };

  if (category && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={category.name}>
        <DescriptionList columns={1} items={[{ label: "Description", value: category.description }]} />
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={category ? category.name : "New category"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="category-form" variant="primary" loading={create.isPending || update.isPending}>
            {category ? "Save changes" : "Add category"}
          </Button>
        </>
      }
    >
      <form id="category-form" className="stack" onSubmit={submit} noValidate>
        <TextInput label="Name" required autoFocus maxLength={100} placeholder="Stationery" hint="Unique in the school, ignoring capitals" {...form.text("name")} />
        <Textarea label="Description" rows={3} maxLength={500} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
