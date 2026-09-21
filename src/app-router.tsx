import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { AuthProvider } from "@/ui/auth/auth-provider";
import { CaseWorkbench } from "@/ui/cases/case-workbench";
import { CaseHistoryDetail } from "@/ui/cases/case-history-detail";
import { CaseHistoryList } from "@/ui/cases/case-history-list";
import { CasesList } from "@/ui/cases/cases-list";
import { NewCaseWizard } from "@/ui/cases/new-case-wizard";
import { ReportPreview } from "@/ui/report/report-preview";
import { RulesList } from "@/ui/rules/rules-list";

function CaseRoute({
  report = false,
  history = false,
  historicalReport = false,
}: {
  report?: boolean;
  history?: boolean;
  historicalReport?: boolean;
}) {
  const { id, revisionNo } = useParams<{ id: string; revisionNo: string }>();
  if (!id) return <Navigate to="/cases" replace />;
  if (historicalReport) {
    const parsedRevisionNo = Number(revisionNo);
    if (!Number.isInteger(parsedRevisionNo) || parsedRevisionNo < 1) {
      return <NotFound />;
    }
    return <ReportPreview caseId={id} revisionNo={parsedRevisionNo} />;
  }
  if (history) {
    if (!revisionNo) return <CaseHistoryList caseId={id} />;
    const parsedRevisionNo = Number(revisionNo);
    if (!Number.isInteger(parsedRevisionNo) || parsedRevisionNo < 1) {
      return <NotFound />;
    }
    return <CaseHistoryDetail caseId={id} revisionNo={parsedRevisionNo} />;
  }
  return report ? <ReportPreview caseId={id} /> : <CaseWorkbench caseId={id} />;
}

function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <h1>找不到這個頁面</h1>
        <Link className="button primary" to="/cases">
          返回案件清單
        </Link>
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">
        跳至主要內容
      </a>
      <header className="app-header">
        <Link className="brand" to="/cases">
          油脂截留器計算系統
        </Link>
        <nav className="app-nav" aria-label="主要導覽">
          <Link to="/cases">案件</Link>
          <Link to="/rules">參考文件</Link>
        </nav>
      </header>
      <main id="main-content">
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/cases" replace />} />
            <Route path="/cases" element={<CasesList />} />
            <Route path="/cases/new" element={<NewCaseWizard />} />
            <Route path="/cases/:id/history" element={<CaseRoute history />} />
            <Route
              path="/cases/:id/history/:revisionNo/report"
              element={<CaseRoute historicalReport />}
            />
            <Route
              path="/cases/:id/history/:revisionNo"
              element={<CaseRoute history />}
            />
            <Route path="/cases/:id/report" element={<CaseRoute report />} />
            <Route path="/cases/:id" element={<CaseRoute />} />
            <Route path="/rules" element={<RulesList />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </main>
    </BrowserRouter>
  );
}
