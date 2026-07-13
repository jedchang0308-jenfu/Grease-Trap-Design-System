import type { Metadata } from "next";
import { NewCaseWizard } from "@/ui/cases/new-case-wizard";

export const metadata: Metadata = { title: "建立案件" };

export default function NewCasePage() {
  return <NewCaseWizard />;
}
