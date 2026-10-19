import { Construction } from "lucide-react";
import { EmptyState } from "./Feedback";
import { Page, PageHeader } from "./PageHeader";

/* Temporary page body while a page is being built */
export function Placeholder({ title, id }: { title: string; id?: string }) {
  return (
    <Page>
      <PageHeader title={title} subtitle={id} />
      <EmptyState icon={<Construction />} title="Coming soon" message="This page is being built." />
    </Page>
  );
}
