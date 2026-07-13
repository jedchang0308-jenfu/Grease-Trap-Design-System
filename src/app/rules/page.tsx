import type { Metadata } from "next";
import { RulesList } from "@/ui/rules/rules-list";

export const metadata: Metadata = { title: "規則版本" };

export default function RulesPage() {
  return <RulesList />;
}
