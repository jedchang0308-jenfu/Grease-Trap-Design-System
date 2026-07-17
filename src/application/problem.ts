import { FirebaseError } from "firebase/app";

export interface ProblemDetails {
  code: string;
  title: string;
  userMessage: string;
  retryable?: boolean;
  fieldErrors?: Record<string, string[]>;
}

export class AppProblem extends Error {
  constructor(public readonly details: ProblemDetails) {
    super(details.userMessage);
  }
}

const firebaseProblems: Record<string, ProblemDetails> = {
  "auth/operation-not-allowed": {
    code: "ANONYMOUS_AUTH_DISABLED",
    title: "匿名連線尚未啟用",
    userMessage:
      "目前無法進入系統。請由管理者在 Firebase Authentication 啟用 Anonymous provider 後重試。",
    retryable: true,
  },
  "auth/network-request-failed": {
    code: "AUTH_NETWORK_ERROR",
    title: "無法建立匿名連線",
    userMessage: "請確認網路連線後重試；尚未登入前不會顯示共享案件。",
    retryable: true,
  },
  "firestore/permission-denied": {
    code: "FIRESTORE_PERMISSION_DENIED",
    title: "目前沒有資料存取權",
    userMessage:
      "匿名登入可能已失效，或 Firebase Rules 拒絕這次操作。請重新整理後重試。",
    retryable: true,
  },
  "permission-denied": {
    code: "FIRESTORE_PERMISSION_DENIED",
    title: "目前沒有資料存取權",
    userMessage:
      "匿名登入可能已失效，或 Firebase Rules 拒絕這次操作。請重新整理後重試。",
    retryable: true,
  },
  "firestore/resource-exhausted": {
    code: "FIRESTORE_QUOTA_EXCEEDED",
    title: "Firebase 免費額度暫時不足",
    userMessage:
      "目前無法完成資料操作。已填資料仍保留在頁面，請稍後再試或通知管理者檢查用量。",
    retryable: true,
  },
  "resource-exhausted": {
    code: "FIRESTORE_QUOTA_EXCEEDED",
    title: "Firebase 免費額度暫時不足",
    userMessage:
      "目前無法完成資料操作。已填資料仍保留在頁面，請稍後再試或通知管理者檢查用量。",
    retryable: true,
  },
  "firestore/unavailable": {
    code: "FIRESTORE_UNAVAILABLE",
    title: "共享資料暫時無法連線",
    userMessage: "請確認網路後重試；不要關閉仍有未送出資料的頁面。",
    retryable: true,
  },
  unavailable: {
    code: "FIRESTORE_UNAVAILABLE",
    title: "共享資料暫時無法連線",
    userMessage: "請確認網路後重試；不要關閉仍有未送出資料的頁面。",
    retryable: true,
  },
  "firestore/deadline-exceeded": {
    code: "FIRESTORE_TIMEOUT",
    title: "共享資料回應逾時",
    userMessage: "這次操作尚未確認完成，請重新載入案件後再重試。",
    retryable: true,
  },
  "deadline-exceeded": {
    code: "FIRESTORE_TIMEOUT",
    title: "共享資料回應逾時",
    userMessage: "這次操作尚未確認完成，請重新載入案件後再重試。",
    retryable: true,
  },
};

export function toProblem(
  error: unknown,
  fallbackMessage = "目前未完成這次操作，已填資料仍保留。請重試。",
): ProblemDetails {
  if (error instanceof AppProblem) return error.details;
  if (error instanceof FirebaseError) {
    return (
      firebaseProblems[error.code] ?? {
        code: error.code
          .toUpperCase()
          .replaceAll("/", "_")
          .replaceAll("-", "_"),
        title: "Firebase 操作未完成",
        userMessage: fallbackMessage,
        retryable: true,
      }
    );
  }
  console.error(error);
  return {
    code: "UNEXPECTED_ERROR",
    title: "操作未完成",
    userMessage: fallbackMessage,
    retryable: true,
  };
}
