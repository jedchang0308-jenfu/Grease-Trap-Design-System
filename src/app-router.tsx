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
import { CasesList } from "@/ui/cases/cases-list";
import { NewCaseWizard } from "@/ui/cases/new-case-wizard";
import { ReportPreview } from "@/ui/report/report-preview";
import { RulesList } from "@/ui/rules/rules-list";

function CaseRoute({ report = false }: { report?: boolean }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/cases" replace />;
  return report ? <ReportPreview caseId={id} /> : <CaseWorkbench caseId={id} />;
}

function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <h1>找不到這個頁面</h1>
        <p className="muted">請返回案件清單，重新選擇要處理的案件。</p>
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
          <Link to="/rules">規則</Link>
        </nav>
      </header>
      <main id="main-content">
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/cases" replace />} />
            <Route path="/cases" element={<CasesList />} />
            <Route path="/cases/new" element={<NewCaseWizard />} />
            <Route path="/cases/:id" element={<CaseRoute />} />
            <Route path="/cases/:id/report" element={<CaseRoute report />} />
            <Route path="/rules" element={<RulesList />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </main>
    </BrowserRouter>
  );
}
