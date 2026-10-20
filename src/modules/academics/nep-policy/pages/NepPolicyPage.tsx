/* Academics › Setup › Policy › NEP 2020: whether the school uses the Holistic Progress Card
   (and for which stages) and the UDISE+ / APAAR exports. What is opted into appears in
   Exams & results › Report cards & publishing. */
import { Page, PageHeader } from "@/common/ui";
import { NepPolicySettings } from "../components/NepPolicySettings";

export default function NepPolicyPage() {
  return (
    <Page>
      <PageHeader
        title="NEP 2020"
        subtitle="What the school opts into. Opted-in features appear in Exams & results › Report cards & publishing; nothing shows while they are off."
      />
      <NepPolicySettings />
    </Page>
  );
}
