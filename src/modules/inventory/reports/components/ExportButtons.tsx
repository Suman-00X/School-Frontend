import { useState } from "react";
import { Download } from "lucide-react";
import { Button, useToast } from "@/common/ui";
import { exportReport } from "../api/reports";

/* "CSV" and "Excel" for one report; each keeps its size while downloading */
export function ExportButtons({ report, query, disabled }: { report: "low-stock" | "valuation" | "consumption"; query?: Record<string, string>; disabled?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);
  const run = async (format: "csv" | "xlsx") => {
    setBusy(format);
    try {
      await exportReport(report, format, query);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="row" style={{ gap: 6 }}>
      <Button size="sm" icon={<Download />} loading={busy === "csv"} disabled={disabled || !!busy} onClick={() => void run("csv")}>
        CSV
      </Button>
      <Button size="sm" icon={<Download />} loading={busy === "xlsx"} disabled={disabled || !!busy} onClick={() => void run("xlsx")}>
        Excel
      </Button>
    </div>
  );
}
