"use client";

import { api } from "@/convex/_generated/api";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { BarLoader } from "react-spinners";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  PlusCircle, 
  Users, 
  ChevronRight, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp,
  Sparkles,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { ExpenseSummary } from "./components/expense-summary";
import { BalanceSummary } from "./components/balance-summary";
import { GroupList } from "./components/group-list";

export default function Dashboard() {
  const { data: balances, isLoading: balancesLoading } = useConvexQuery(
    api.dashboard.getUserBalances
  );

  const { data: groups, isLoading: groupsLoading } = useConvexQuery(
    api.dashboard.getUserGroups
  );

  const { data: totalSpent, isLoading: totalSpentLoading } = useConvexQuery(
    api.dashboard.getTotalSpent
  );

  const { data: monthlySpending, isLoading: monthlySpendingLoading } =
    useConvexQuery(api.dashboard.getMonthlySpending);

  const isLoading =
    balancesLoading ||
    groupsLoading ||
    totalSpentLoading ||
    monthlySpendingLoading;

  return (
    <div className="max-w-5xl mx-auto pt-2 pb-6 space-y-6">
      {isLoading ? (
        <div className="w-full py-10 flex justify-center">
          <BarLoader width={"100%"} color="#36d7b7" />
        </div>
      ) : (
        <>
          {/* Header Area */}
          <div className="flex justify-between flex-col sm:flex-row sm:items-center gap-3 pb-3 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl gradient-title">Dashboard</h1>
                <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Sync Active
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                A quick view of your balances, spending, and active groups.
              </p>
            </div>
            <Button asChild className="shadow-sm hover:shadow-md transition-shadow">
              <Link href="/expenses/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add expense
              </Link>
            </Button>
          </div>

          {/* Balance overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Balance Card */}
            <Card className="py-4 gap-1 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 border-neutral-100 bg-linear-to-br from-white to-neutral-50/50">
              <CardHeader className="pb-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Balance
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-neutral-100/75 text-neutral-600 border border-neutral-200/50">
                  <Wallet className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">
                  {balances?.totalBalance > 0 ? (
                    <span className="text-green-600">
                      +${balances?.totalBalance.toFixed(2)}
                    </span>
                  ) : balances?.totalBalance < 0 ? (
                    <span className="text-red-600">
                      -${Math.abs(balances?.totalBalance).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-neutral-700">$0.00</span>
                  )}
                </div>
                <div className="mt-1 flex items-center">
                  {balances?.totalBalance > 0 ? (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                      You are owed money
                    </span>
                  ) : balances?.totalBalance < 0 ? (
                    <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                      You owe money
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-neutral-600 bg-neutral-50 px-2 py-0.5 rounded-full border border-neutral-100">
                      All settled up!
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* You are owed Card */}
            <Card className="py-4 gap-1 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 border-neutral-100 bg-linear-to-br from-white to-neutral-50/50">
              <CardHeader className="pb-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  You are owed
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-green-600">
                  ${balances?.youAreOwed.toFixed(2)}
                </div>
                <div className="mt-1 flex items-center">
                  <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                    From {balances?.oweDetails?.youAreOwedBy?.length || 0} {balances?.oweDetails?.youAreOwedBy?.length === 1 ? "person" : "people"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* You owe Card */}
            <Card className="py-4 gap-1 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 border-neutral-100 bg-linear-to-br from-white to-neutral-50/50">
              <CardHeader className="pb-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  You owe
                </CardTitle>
                <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {balances?.oweDetails?.youOwe?.length > 0 ? (
                  <>
                    <div className="text-3xl font-bold tracking-tight text-red-600">
                      ${balances?.youOwe.toFixed(2)}
                    </div>
                    <div className="mt-1 flex items-center">
                      <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                        To {balances?.oweDetails?.youOwe?.length || 0} {balances?.oweDetails?.youOwe?.length === 1 ? "person" : "people"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-bold tracking-tight text-neutral-400">$0.00</div>
                    <div className="mt-1 flex items-center">
                      <span className="text-xs font-semibold text-neutral-600 bg-neutral-50 px-2 py-0.5 rounded-full border border-neutral-100">
                        You don't owe anyone
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main dashboard content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Expense summary */}
              <ExpenseSummary
                monthlySpending={monthlySpending}
                totalSpent={totalSpent}
              />
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Balance details */}
              <Card className="py-5 gap-4 shadow-sm hover:shadow-md transition-all duration-300 border-neutral-100 bg-linear-to-br from-white to-neutral-50/50">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-1.5 text-neutral-800">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Balance Details
                    </CardTitle>
                    <Button variant="link" asChild className="p-0 h-auto text-xs text-teal-600 hover:text-teal-700 flex items-center gap-0.5">
                      <Link href="/contacts">
                        View all
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <BalanceSummary balances={balances} />
                </CardContent>
              </Card>

              {/* Groups */}
              <Card className="py-5 gap-4 shadow-sm hover:shadow-md transition-all duration-300 border-neutral-100 bg-linear-to-br from-white to-neutral-50/50">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-1.5 text-neutral-800">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                      Your Groups
                    </CardTitle>
                    <Button variant="link" asChild className="p-0 h-auto text-xs text-teal-600 hover:text-teal-700 flex items-center gap-0.5">
                      <Link href="/contacts">
                        View all
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-0">
                  <GroupList groups={groups} />
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="outline" asChild className="w-full mt-2 border-neutral-200 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/20 transition-all duration-200">
                    <Link href="/contacts?createGroup=true">
                      <Users className="mr-2 h-4 w-4" />
                      Create new group
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
