"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";

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
  ["CURRENT_QG", "現行 Q/G", "現行方法的流量與油脂量設計需求。"],
  ["LEGACY_QV", "舊版 Q/V", "歷史指引有效容積換算，報告會標示時效。"],
  ["DUAL_COMPARISON", "新舊雙軌", "兩軌分開計算；任一軌有效即可繼續覆核。"],
] as const;

const diningTypes = [
  ["CHINESE", "中餐"],
  ["WESTERN", "西餐"],
  ["JAPANESE", "和食"],
  ["RAMEN", "拉麵"],
  ["UDON_SOBA", "烏龍麵、蕎麥麵"],
  ["LIGHT_MEAL", "簡餐"],
  ["FOOD_COURT", "小吃、美食街"],
  ["FAST_FOOD", "速食"],
  ["FACTORY_CAFETERIA", "工廠員工餐廳"],
  ["STUDENT_CAFETERIA", "學生餐廳"],
  ["SCHOOL_LUNCH", "學校午餐"],
] as const;

export function NewCaseWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [taskCode, setTaskCode] = useState<(typeof tasks)[number][0]>(
    "T02_DINERS_TO_DESIGN",
  );
  const [mode, setMode] = useState<(typeof modes)[number][0]>("CURRENT_QG");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setProblem(null);
    const data = new FormData(event.currentTarget);
    try {
      const created = await fetchJson<{ caseId: string }>("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskCode,
          mode,
          customer: data.get("customer"),
          location: data.get("location"),
          title: data.get("title"),
          purpose: data.get("purpose"),
          diningType: data.get("diningType"),
          evidenceSource: data.get("evidenceSource"),
        }),
      });
      router.push(`/cases/${created.caseId}`);
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "案件建立未完成，已填資料仍保留。請重試。" },
      );
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
          <div className="form-grid">
            <div className="field">
              <label htmlFor="customer">客戶名稱</label>
              <input
                id="customer"
                name="customer"
                required
                autoComplete="organization"
              />
            </div>
            <div className="field">
              <label htmlFor="location">案件地點</label>
              <input id="location" name="location" required />
            </div>
            <div className="field">
              <label htmlFor="title">案件名稱</label>
              <input id="title" name="title" required />
            </div>
            <div className="field">
              <label htmlFor="diningType">餐飲類型</label>
              <select id="diningType" name="diningType" defaultValue="CHINESE">
                {diningTypes.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field span-2">
              <label htmlFor="purpose">用途／情境</label>
              <textarea
                id="purpose"
                name="purpose"
                placeholder="簡述本次計算要支持的工程判斷"
              />
            </div>
            <div className="field span-2">
              <label htmlFor="evidenceSource">資料提供者或證據</label>
              <input
                id="evidenceSource"
                name="evidenceSource"
                placeholder="例如：客戶提供平面圖 2026-07-13"
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
