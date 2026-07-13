import type { Metadata } from "next";
import { CaseWorkbench } from "@/ui/cases/case-workbench";

export const metadata: Metadata = { title: "案件工作台" };

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseWorkbench caseId={id} />;
}
