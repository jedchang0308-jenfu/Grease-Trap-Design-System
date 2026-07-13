import type { Metadata } from "next";
import { CasesList } from "@/ui/cases/cases-list";

export const metadata: Metadata = { title: "案件清單" };

export default function CasesPage() {
  return <CasesList />;
}
