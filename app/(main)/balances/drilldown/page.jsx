"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileText, Scale } from "lucide-react";
import Link from "next/link";

export default function DrilldownPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const groupId = sp.get("groupId");
  const userAId = sp.get("userAId");
  const userBId = sp.get("userBId");

  const data = useQuery(
    api.balances.getDrilldown,
    groupId && userAId && userBId 
      ? { groupId: groupId, userAId: userAId, userBId: userBId } 
      : "skip"
  );

  if (!groupId || !userAId || !userBId) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
        <p className="text-muted-foreground">Missing required parameters.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-muted-foreground animate-pulse">Loading audit ledger...</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
        <p className="text-muted-foreground">No ledger entries found between these members.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const { users, entries, finalBalance } = data;
  const { userA, userB } = users;

  return (
    <div className="max-w-4xl mx-auto pt-2 pb-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-3 border-b border-neutral-100">
        <div>
          <Button
            variant="outline"
            size="sm"
            className="mb-2 border-neutral-200"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl gradient-title flex items-center gap-2">
            <Scale className="h-6 w-6 text-teal-600" />
            Pairwise Audit Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Chronological expense and settlement logs between <span className="font-semibold text-neutral-800">{userA.name}</span> and <span className="font-semibold text-neutral-800">{userB.name}</span>.
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="shadow-sm border-neutral-100 bg-linear-to-br from-white to-neutral-50/50">
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ledger Balance</p>
            <h3 className="text-3xl font-bold tracking-tight mt-1">
              {finalBalance > 0 ? (
                <span className="text-green-600">
                  {userB.name} owes {userA.name}
                </span>
              ) : finalBalance < 0 ? (
                <span className="text-red-600">
                  {userA.name} owes {userB.name}
                </span>
              ) : (
                <span className="text-neutral-500">Fully Settled</span>
              )}
            </h3>
          </div>
          <div className={`text-3xl font-extrabold tracking-tight ${finalBalance > 0 ? "text-green-600" : finalBalance < 0 ? "text-red-600" : "text-neutral-500"}`}>
            ${Math.abs(finalBalance).toFixed(2)}
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card className="shadow-sm border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50/75 border-b border-neutral-100">
              <tr>
                <th className="p-3 text-left font-semibold text-neutral-600">Date</th>
                <th className="p-3 text-left font-semibold text-neutral-600">Description</th>
                <th className="p-3 text-left font-semibold text-neutral-600">Type</th>
                <th className="p-3 text-right font-semibold text-neutral-600">Total Amt</th>
                <th className="p-3 text-right font-semibold text-neutral-600">Share</th>
                <th className="p-3 text-left font-semibold text-neutral-600">Direction</th>
                <th className="p-3 text-right font-semibold text-neutral-600">Running Bal</th>
                <th className="p-3 text-center font-semibold text-neutral-600">Source</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, index) => (
                <tr key={index} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/30 transition-colors">
                  <td className="p-3 whitespace-nowrap text-neutral-600">
                    {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="p-3 font-medium text-neutral-800 min-w-[160px]">{e.description}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      e.type === "expense" 
                        ? "bg-teal-50 text-teal-700 border-teal-100" 
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    }`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="p-3 text-right text-neutral-600">${e.amount.toFixed(2)}</td>
                  <td className="p-3 text-right font-semibold text-neutral-700">${e.share.toFixed(2)}</td>
                  <td className="p-3 text-xs text-neutral-500 font-medium">{e.direction}</td>
                  <td className={`p-3 text-right font-bold ${e.runningBalance > 0 ? "text-green-600" : e.runningBalance < 0 ? "text-red-600" : "text-neutral-700"}`}>
                    ${Math.abs(e.runningBalance).toFixed(2)}
                  </td>
                  <td className="p-3 text-center">
                    {e.sourceImportRowId ? (
                      <Link
                        href={`/import?importRowId=${e.sourceImportRowId}`}
                        className="inline-flex items-center justify-center p-1 bg-teal-50 text-teal-700 rounded-md border border-teal-100 hover:bg-teal-100 transition-colors"
                        title="Audit staged CSV row source"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="text-neutral-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-muted-foreground" colSpan={8}>
                    No transactions logged between these members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
