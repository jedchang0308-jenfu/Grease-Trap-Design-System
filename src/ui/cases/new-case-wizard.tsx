import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCase } from "@/application/cases/repository";
import { createCaseSchema } from "@/application/cases/schemas";
import { AppProblem, toProblem } from "@/application/problem";
import {
  calculationBasisDisplay,
  calculationModeDisplay,
} from "@/domain/rules/source-display";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";

const tasks = [
  ["T01_DINERS_TO_FLOW", "我知道每日用餐人數，要換算流量。"],
  ["T02_DINERS_TO_DESIGN", "我知道每日用餐人數，要規劃設計需求。"],
  ["T03_AREA_TO_FLOW", "我知道廚房與用餐區面積，要換算流量。"],
  ["T04_AREA_TO_DESIGN", "我知道廚房與用餐區面積，要規劃設計需求。"],
  [
    "T05_DESIGN_TO_DINERS_AND_AREA",
    "我知道設備能力／有效容積，要反推等效人數及面積。",
  ],
] as const;

const modes = [
  [
    "CURRENT_QG",
    calculationBasisDisplay.CURRENT_QG.shortLabel,
    calculationBasisDisplay.CURRENT_QG.resultLabel,
  ],
  [
    "LEGACY_QV",
    calculationBasisDisplay.LEGACY_QV.shortLabel,
    calculationBasisDisplay.LEGACY_QV.resultLabel,
  ],
  [
    "DUAL_COMPARISON",
    calculationModeDisplay.DUAL_COMPARISON.label,
    "兩份資料來源分開計算；任一份有效即可預覽並匯出報告草稿。",
  ],
] as const;

export function NewCaseWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [taskCode, setTaskCode] = useState<(typeof tasks)[number][0]>(
    "T02_DINERS_TO_DESIGN",
  );
  const [mode, setMode] = useState<(typeof modes)[number][0]>("CURRENT_QG");
  const [metadata, setMetadata] = useState({
    customer: "",
    location: "",
    title: "",
    purpose: "",
    evidenceSource: "",
  });
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  useEffect(() => setHydrated(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setProblem(null);
    try {
      const parsed = createCaseSchema.safeParse({
        taskCode,
        mode,
        ...metadata,
      });
      if (!parsed.success) {
        throw new AppProblem({
          code: "INVALID_CASE",
          title: "案件資料格式不正確",
          userMessage: "請修正欄位後再建立案件。",
          fieldErrors: parsed.error.flatten().fieldErrors as Record<
            string,
            string[]
          >,
        });
      }
      const created = await createCase(parsed.data);
      navigate(`/cases/${created.case_group_id}`);
    } catch (error) {
      setProblem(toProblem(error, "案件建立未完成，已填資料仍保留。請重試。"));
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>建立案件</h1>
          <p className="lede">先選擇你要解決的問題，再填入已知資料。</p>
        </div>
      </header>
      <span
        data-testid="new-case-wizard-ready"
        data-ready={hydrated ? "true" : "false"}
        hidden
      />
      <ol className="stepper" aria-label="建立案件步驟">
        <li className={step === 1 ? "active" : ""}>1. 選擇任務</li>
        <li className={step === 2 ? "active" : ""}>2. 計算模式</li>
        <li className={step === 3 ? "active" : ""}>3. 基本資料</li>
      </ol>

      {problem ? <RuntimeError problem={problem} /> : null}

      {step === 1 ? (
        <section className="panel">
          <h2>你要解決什麼問題？</h2>
          <div className="choice-grid" role="radiogroup" aria-label="客戶任務">
            {tasks.map(([value, label]) => (
              <label className="choice" key={value}>
                <input
                  type="radio"
                  name="task"
                  value={value}
                  checked={taskCode === value}
                  onChange={() => setTaskCode(value)}
                />
                <strong>{label}</strong>
                <span>選擇此任務</span>
              </label>
            ))}
          </div>
          <div className="button-row end" style={{ marginTop: 20 }}>
            <button
              className="button primary"
              type="button"
              onClick={() => setStep(2)}
            >
              下一步：選擇模式
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel">
          <h2>選擇計算模式</h2>
          <div className="choice-grid" role="radiogroup" aria-label="計算模式">
            {modes.map(([value, label, description]) => (
              <label className="choice" key={value}>
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <strong>{label}</strong>
                <span>{description}</span>
              </label>
            ))}
          </div>
          <div className="button-row end" style={{ marginTop: 20 }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => setStep(1)}
            >
              返回
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => setStep(3)}
            >
              下一步：填寫資料
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <form className="panel" onSubmit={submit}>
          <h2>案件基本資料</h2>
          <p className="help">
            以下資料皆可選填；建立案件後，再於計算資料選擇餐飲類型。
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="customer">客戶名稱（選填）</label>
              <input
                id="customer"
                name="customer"
                autoComplete="organization"
                value={metadata.customer}
                onChange={(event) =>
                  setMetadata((previous) => ({
                    ...previous,
                    customer: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="location">案件地點（選填）</label>
              <input
                id="location"
                name="location"
                value={metadata.location}
                onChange={(event) =>
                  setMetadata((previous) => ({
                    ...previous,
                    location: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="title">案件名稱（選填）</label>
              <input
                id="title"
                name="title"
                value={metadata.title}
                onChange={(event) =>
                  setMetadata((previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field span-2">
              <label htmlFor="purpose">用途／情境（選填）</label>
              <textarea
                id="purpose"
                name="purpose"
                placeholder="簡述本次計算要支持的工程判斷"
                value={metadata.purpose}
                onChange={(event) =>
                  setMetadata((previous) => ({
                    ...previous,
                    purpose: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field span-2">
              <label htmlFor="evidenceSource">資料提供者或證據（選填）</label>
              <input
                id="evidenceSource"
                name="evidenceSource"
                placeholder="例如：客戶提供平面圖 2026-07-13"
                value={metadata.evidenceSource}
                onChange={(event) =>
                  setMetadata((previous) => ({
                    ...previous,
                    evidenceSource: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="button-row end" style={{ marginTop: 20 }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => setStep(2)}
            >
              返回
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "正在建立…" : "建立案件並填寫計算資料"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
