import type { Metadata } from "next";
import { ReportPreview } from "@/ui/report/report-preview";

export const metadata: Metadata = { title: "報告預覽與核發" };

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportPreview caseId={id} />;
}
