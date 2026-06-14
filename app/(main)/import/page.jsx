"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";

export default function ImportPage() {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [activeImportId, setActiveImportId] = useState(null);
  const [busy, setBusy] = useState(false);

  const groupData = useQuery(api.groups.getGroupOrMembers, {});
  const importData = useQuery(
    api.imports.get,
    activeImportId ? { importId: activeImportId } : "skip"
  );

  const createImport = useMutation(api.imports.create);
  const reviewAnomaly = useMutation(api.imports.reviewAnomaly);
  const approveImport = useMutation(api.imports.approve);
  const commitImport = useMutation(api.imports.commit);

  const groups = groupData?.groups ?? [];
  const anomalies = importData?.anomalies ?? [];
  const rows = importData?.rows ?? [];
  const reviews = importData?.reviews ?? [];
  const report = importData?.report?.summaryJson;
  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${importData.import.fileName || "import"}.report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportCsv = () => {
    if (!report) return;
    const rows = report.rowsProcessed ? [] : [];
    // Flatten anomalies as CSV
    const cols = ["rowNumber", "type", "severity", "message", "suggestedAction", "status"];
    const lines = [cols.join(",")];
    (importData?.anomalies || []).forEach((a) => {
      lines.push([a.rowNumber, a.type, a.severity, `"${a.message.replace(/"/g, '""')}")`, a.suggestedAction, a.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${importData.import.fileName || "import"}.anomalies.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reviewedAnomalyIds = useMemo(
    () => new Set(reviews.map((review) => review.anomalyId)),
    [reviews]
  );

  const anomalyCounts = useMemo(() => {
    return anomalies.reduce(
      (acc, anomaly) => {
        acc.total += 1;
        acc[anomaly.severity] = (acc[anomaly.severity] ?? 0) + 1;
        if (!reviewedAnomalyIds.has(anomaly._id) && anomaly.status === "open") {
          acc.open += 1;
        }
        return acc;
      },
      { total: 0, blocking: 0, warning: 0, info: 0, open: 0 }
    );
  }, [anomalies, reviewedAnomalyIds]);

  const handleFileChange = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    const text = await file.text();
    setCsvText(text);
  };

  const handleCreateImport = async () => {
    if (!selectedGroupId) {
      toast.error("Select a group first");
      return;
    }
    if (!selectedFile || !csvText.trim()) {
      toast.error("Choose a CSV file first");
      return;
    }

    setBusy(true);
    try {
      const result = await createImport({
        groupId: selectedGroupId,
        fileName: selectedFile.name,
        csvText,
      });
      setActiveImportId(result.importId);
      toast.success(
        `Staged ${result.rowCount} rows with ${result.anomalyCount} anomalies`
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReview = async (anomalyId, decision, correctedValue = null) => {
    setBusy(true);
    try {
      await reviewAnomaly({ anomalyId, decision, correctedValue });
      toast.success("Decision saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!activeImportId) return;
    setBusy(true);
    try {
      await approveImport({ importId: activeImportId });
      toast.success("Import approved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!activeImportId) return;
    setBusy(true);
    try {
      const result = await commitImport({ importId: activeImportId });
      toast.success(
        `Imported ${result.importedCount} rows, skipped ${result.skippedCount}`
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl py-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal">
            CSV Import
          </h1>
          <p className="text-muted-foreground">
            Stage, review, approve, and report messy expense data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!activeImportId || busy}
            onClick={handleApprove}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button variant="outline" disabled={!report} onClick={exportReport}>
            Export JSON
          </Button>
          <Button variant="outline" disabled={!report} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button disabled={!activeImportId || busy} onClick={handleCommit}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Commit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Group</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                >
                  <option value="">Select group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv">CSV file</Label>
                <Input
                  id="csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleFileChange(event.target.files?.[0])}
                />
              </div>
              <Button
                className="w-full"
                disabled={busy || !selectedGroupId || !selectedFile}
                onClick={handleCreateImport}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Stage import
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryRow label="Status" value={importData?.import?.status ?? "-"} />
              <SummaryRow label="Rows" value={importData?.import?.rowCount ?? 0} />
              <SummaryRow label="Imported" value={importData?.import?.importedCount ?? 0} />
              <SummaryRow label="Skipped" value={importData?.import?.skippedCount ?? 0} />
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="outline">All {anomalyCounts.total}</Badge>
                <Badge className="bg-red-600">Blocking {anomalyCounts.blocking}</Badge>
                <Badge className="bg-amber-600">Warnings {anomalyCounts.warning}</Badge>
                <Badge variant="secondary">Open {anomalyCounts.open}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Row</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2">Payer</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-left p-2">Currency</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 80).map((row) => (
                      <tr key={row._id} className="border-t">
                        <td className="p-2">{row.rowNumber}</td>
                        <td className="p-2 whitespace-nowrap">{row.raw.date}</td>
                        <td className="p-2 min-w-[220px]">{row.raw.description}</td>
                        <td className="p-2">{row.raw.paid_by || "-"}</td>
                        <td className="p-2 text-right">{row.raw.amount}</td>
                        <td className="p-2">{row.raw.currency || "-"}</td>
                        <td className="p-2">
                          <Badge variant="outline">{row.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td className="p-6 text-center text-muted-foreground" colSpan={7}>
                          No staged rows yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anomaly Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {anomalies.map((anomaly) => (
                <div
                  key={anomaly._id}
                  className="border rounded-md p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <Badge variant={anomaly.severity === "blocking" ? "destructive" : "secondary"}>
                        {anomaly.severity}
                      </Badge>
                      <Badge variant="outline">row {anomaly.rowNumber}</Badge>
                      <span className="font-medium">{anomaly.type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {anomaly.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Suggested: {anomaly.suggestedAction} · Confidence{" "}
                      {Math.round(anomaly.confidenceScore * 100)}%
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || reviewedAnomalyIds.has(anomaly._id)}
                      onClick={() => handleReview(anomaly._id, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || reviewedAnomalyIds.has(anomaly._id)}
                      onClick={() => handleReview(anomaly._id, "skip")}
                    >
                      Skip row
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || reviewedAnomalyIds.has(anomaly._id)}
                      onClick={() => {
                        const val = window.prompt(
                          `Enter corrected value for ${anomaly.type} (row ${anomaly.rowNumber}):`,
                          anomaly.metadata?.suggested || ""
                        );
                        if (val !== null) handleReview(anomaly._id, "correct", val);
                      }}
                    >
                      Correct
                    </Button>
                    {anomaly.type === "SETTLEMENT_LOGGED_AS_EXPENSE" && (
                      <Button
                        size="sm"
                        disabled={busy || reviewedAnomalyIds.has(anomaly._id)}
                        onClick={() =>
                          handleReview(anomaly._id, "convert_to_settlement")
                        }
                      >
                        Convert
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {anomalies.length === 0 && (
                <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">
                  No anomalies staged.
                </div>
              )}
            </CardContent>
          </Card>

          {report && (
            <Card>
              <CardHeader>
                <CardTitle>Import Report</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
