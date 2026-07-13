import type { Metadata } from "next";
import { ReviewWorkbench } from "@/ui/review/review-workbench";

export const metadata: Metadata = { title: "工程覆核" };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewWorkbench caseId={id} />;
}
