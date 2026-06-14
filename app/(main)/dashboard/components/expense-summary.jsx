"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function ExpenseSummary({ monthlySpending, totalSpent }) {
  // Format monthly data for chart
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const chartData =
    monthlySpending?.map((item) => {
      const date = new Date(item.month);
      return {
        name: monthNames[date.getMonth()],
        amount: item.total,
      };
    }) || [];

  // Get current year
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  return (
    <Card className="py-5 gap-4 shadow-sm hover:shadow-md transition-shadow duration-200 border-neutral-100 bg-linear-to-br from-white to-neutral-50/50">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg font-bold flex items-center justify-between">
          <span>Expense Summary</span>
          <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-semibold border border-teal-100 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            Monthly Analysis
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-neutral-100 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total this month</p>
            <h3 className="text-2xl font-bold mt-1 text-teal-600 tracking-tight">
              ${monthlySpending?.[currentMonth]?.total.toFixed(2) || "0.00"}
            </h3>
          </div>
          <div className="bg-white rounded-lg p-4 border border-neutral-100 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total this year</p>
            <h3 className="text-2xl font-bold mt-1 tracking-tight text-neutral-800">
              ${totalSpent?.toFixed(2) || "0.00"}
            </h3>
          </div>
        </div>

        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.85}/>
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.15}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px 12px' }}
                itemStyle={{ color: '#34d399', fontSize: '12px' }}
                labelStyle={{ color: '#9ca3af', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}
                formatter={(value) => [`$${value.toFixed(2)}`, "Amount"]}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="amount" fill="url(#chartGradient)" radius={[4, 4, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2 font-medium">
          Monthly spending breakdown for {currentYear}
        </p>
      </CardContent>
    </Card>
  );
}
