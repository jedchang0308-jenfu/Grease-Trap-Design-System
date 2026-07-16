import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/config/env";

export interface ReportStorage {
  save(reportId: string, reportNumber: string, pdf: Buffer): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

class FilesystemReportStorage implements ReportStorage {
  async save(reportId: string, reportNumber: string, pdf: Buffer) {
    const relativePath = path.posix.join(
      env.REPORT_OUTPUT_DIR.replaceAll("\\", "/"),
      `${reportNumber}-${reportId}.pdf`,
    );
    const resolved = path.resolve(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, pdf);
    return relativePath;
  }

  async read(storagePath: string) {
    return readFile(path.resolve(storagePath));
  }

  async delete(storagePath: string) {
    await unlink(path.resolve(storagePath)).catch(() => undefined);
  }
}

class FirebaseReportStorage implements ReportStorage {
  async bucket() {
    return (await import("@/infrastructure/firebase/admin")).storageBucket;
  }

  async save(reportId: string, reportNumber: string, pdf: Buffer) {
    const storagePath = `reports/${reportId}.pdf`;
    const bucket = await this.bucket();
    await bucket.file(storagePath).save(pdf, {
      resumable: false,
      contentType: "application/pdf",
      metadata: {
        cacheControl: "private, no-store",
        metadata: { reportId, reportNumber },
      },
    });
    return storagePath;
  }

  async read(storagePath: string) {
    const bucket = await this.bucket();
    const [buffer] = await bucket.file(storagePath).download();
    return buffer;
  }

  async delete(storagePath: string) {
    const bucket = await this.bucket();
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
  }
}

export const reportStorage: ReportStorage =
  env.DATA_BACKEND === "firestore"
    ? new FirebaseReportStorage()
    : new FilesystemReportStorage();
