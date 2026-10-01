import {
  currentRulePayload,
  legacyRulePayload,
  sourceDocuments,
} from "./seed-data";
import { sha256 } from "@/domain/shared/canonical";
import { calculationTrackOrder } from "./source-display";

export const currentRuleChecksum = sha256(currentRulePayload);
export const legacyRuleChecksum = sha256(legacyRulePayload);

const currentSource = sourceDocuments.find(
  (source) => source.code === "SRC-CURRENT-2020",
)!;
const legacySource = sourceDocuments.find(
  (source) => source.code === "SRC-LEGACY-FULL",
)!;

export const ruleCatalog = {
  LEGACY_QV: {
    id: "RULE-LEGACY-QV@legacy.1",
    code: "RULE-LEGACY-QV",
    version: "legacy.1",
    versionLabel: "2008/08/11",
    methodFamily: "LEGACY_QV",
    status: "ACTIVE",
    checksum: legacyRuleChecksum,
    activatedAt: "2026-07-13T00:00:00.000Z",
    sourceCode: legacySource.code,
    sourceTitle: legacySource.title,
    sourceHash: legacySource.sha256,
  },
  CURRENT_QG: {
    id: "RULE-CURRENT-QG@2020.1",
    code: "RULE-CURRENT-QG",
    version: "2020.1",
    versionLabel: "2020.1",
    methodFamily: "CURRENT_QG",
    status: "ACTIVE",
    checksum: currentRuleChecksum,
    activatedAt: "2026-07-13T00:00:00.000Z",
    sourceCode: currentSource.code,
    sourceTitle: currentSource.title,
    sourceHash: currentSource.sha256,
  },
} as const;

export type RuleTrack = keyof typeof ruleCatalog;

export function ruleSnapshot(track: RuleTrack) {
  const rule = ruleCatalog[track];
  return {
    code: rule.code,
    version: rule.version,
    checksum: rule.checksum,
    sourceCode: rule.sourceCode,
    sourceTitle: rule.sourceTitle,
    sourceHash: rule.sourceHash,
  };
}

export function presentRuleSets() {
  return calculationTrackOrder.map((track) => {
    const rule = ruleCatalog[track];
    return {
      id: rule.id,
      code: rule.code,
      version: rule.version,
      versionLabel: rule.versionLabel,
      methodFamily: rule.methodFamily,
      status: rule.status,
      checksum: rule.checksum,
      activatedAt: rule.activatedAt,
      source: rule.sourceTitle,
      sourceHash: rule.sourceHash,
    };
  });
}
