"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  User,
  Clock,
  CheckCircle,
  ShieldAlert,
  Users,
  BarChart3,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Zap,
  MessageSquare,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts"

// ── Interfaces ──

interface TicketStats {
  open: number
  myTickets: number
  overdue: number
  unassigned: number
  byStatus: { status: string; count: number }[]
  byPriority: { priority: string; count: number }[]
  byCategory: { category: string; count: number }[]
  slaCompliance: { total: number; breached: number; rate: number }
  avgResponseTime: number
  recentActivity: number
  byCompany: { company_name: string; count: number }[]
  weeklyTrend: { week: string; count: number }[]
  recentTickets: {
    id: string
    ticket_number: string
    subject: string
    priority: string
    status: string
    company_name: string
    assigned_to_name: string | null
    created_by_name: string
    created_at: string
    due_date: string | null
  }[]
}

// ── Color Maps ──

const STATUS_COLORS: Record<string, string> = {
  New: "#9CA3AF",
  Open: "#3B82F6",
  "In Progress": "#6366F1",
  "Waiting on Customer": "#F59E0B",
  "Waiting on Internal": "#A855F7",
  Escalated: "#EF4444",
  Resolved: "#22C55E",
  Closed: "#6B7280",
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F97316",
  Medium: "#3B82F6",
  Low: "#9CA3AF",
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  New: "bg-gray-100 text-gray-800",
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-indigo-100 text-indigo-800",
  "Waiting on Customer": "bg-amber-100 text-amber-800",
  "Waiting on Internal": "bg-purple-100 text-purple-800",
  Escalated: "bg-red-100 text-red-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-800",
}

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-blue-100 text-blue-800",
  Low: "bg-gray-100 text-gray-800",
}

export default function TicketDashboardPage() {
  const { user, hasPermission } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const isEnsuredit = ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "")

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/tickets/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching ticket stats:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (user && hasPermission("tickets")) {
      fetchStats()
      const interval = setInterval(() => fetchStats(), 300000) // 5-min auto-refresh
      return () => clearInterval(interval)
    }
  }, [user, fetchStats, hasPermission])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  }

  const formatWeekLabel = (weekStr: string) => {
    const d = new Date(weekStr)
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  }

  if (!hasPermission("tickets")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to view ticket dashboard.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                  <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                  <div className="h-8 w-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-72 animate-pulse">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <p className="text-gray-500">Failed to load dashboard data.</p>
          <button onClick={() => fetchStats()} className="mt-4 text-blue-600 hover:underline">
            Try Again
          </button>
        </div>
      </DashboardLayout>
    )
  }

  // Prepare chart data
  const statusChartData = stats.byStatus.map((s) => ({
    name: s.status,
    value: Number(s.count),
    color: STATUS_COLORS[s.status] || "#9CA3AF",
  }))

  const priorityChartData = stats.byPriority.map((p) => ({
    name: p.priority,
    value: Number(p.count),
    color: PRIORITY_COLORS[p.priority] || "#9CA3AF",
  }))

  const categoryChartData = stats.byCategory.map((c) => ({
    name: c.category,
    value: Number(c.count),
  }))

  const trendChartData = (stats.weeklyTrend || []).map((t) => ({
    name: formatWeekLabel(t.week),
    tickets: Number(t.count),
  }))

  const companyChartData = (stats.byCompany || []).map((c) => ({
    name: c.company_name,
    value: Number(c.count),
  }))

  const slaRate = stats.slaCompliance.rate
  const slaColor = slaRate >= 90 ? "text-green-600" : slaRate >= 70 ? "text-yellow-600" : "text-red-600"
  const slaBg = slaRate >= 90 ? "bg-green-50" : slaRate >= 70 ? "bg-yellow-50" : "bg-red-50"

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ticket Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Overview of all support tickets{user?.companyName ? ` for ${user.companyName}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchStats(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={() => router.push("/tickets")}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View All Tickets
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Open Tickets */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">Open Tickets</p>
                <div className="bg-blue-50 p-2 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.open}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.unassigned} unassigned</p>
            </div>

            {/* My Tickets */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">My Tickets</p>
                <div className="bg-indigo-50 p-2 rounded-lg">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.myTickets}</p>
              <p className="text-xs text-gray-500 mt-1">Assigned to or created by me</p>
            </div>

            {/* Overdue */}
            <div className={`bg-white rounded-xl shadow-sm border ${stats.overdue > 0 ? "border-red-200" : "border-gray-200"} p-6`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <div className={`${stats.overdue > 0 ? "bg-red-50" : "bg-gray-50"} p-2 rounded-lg`}>
                  <Clock className={`h-5 w-5 ${stats.overdue > 0 ? "text-red-600" : "text-gray-400"}`} />
                </div>
              </div>
              <p className={`text-3xl font-bold mt-2 ${stats.overdue > 0 ? "text-red-600" : "text-gray-900"}`}>{stats.overdue}</p>
              <p className="text-xs text-gray-500 mt-1">Past due date</p>
            </div>

            {/* SLA Compliance */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">SLA Compliance</p>
                <div className={`${slaBg} p-2 rounded-lg`}>
                  <CheckCircle className={`h-5 w-5 ${slaColor}`} />
                </div>
              </div>
              <p className={`text-3xl font-bold mt-2 ${slaColor}`}>{slaRate}%</p>
              <p className="text-xs text-gray-500 mt-1">{stats.slaCompliance.breached} breached of {stats.slaCompliance.total}</p>
            </div>
          </div>

          {/* Row 2: Quick Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 flex items-center gap-4">
              <div className="bg-amber-50 p-2 rounded-lg">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg Response Time</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.avgResponseTime > 0 ? `${stats.avgResponseTime}h` : "N/A"}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 flex items-center gap-4">
              <div className="bg-purple-50 p-2 rounded-lg">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Tickets</p>
                <p className="text-lg font-bold text-gray-900">{stats.recentActivity}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 flex items-center gap-4">
              <div className="bg-orange-50 p-2 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">SLA Breached</p>
                <p className={`text-lg font-bold ${stats.slaCompliance.breached > 0 ? "text-red-600" : "text-gray-900"}`}>
                  {stats.slaCompliance.breached}
                </p>
              </div>
            </div>
          </div>

          {/* Row 3: Status & Priority Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Status Distribution</h3>
              {statusChartData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-1/2">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`${value}`, "Tickets"]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2">
                    {statusChartData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-gray-600 truncate">{item.name}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-16">No ticket data yet</p>
              )}
            </div>

            {/* Priority Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Priority Breakdown</h3>
              {priorityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={priorityChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                    <Tooltip
                      formatter={(value) => [`${value}`, "Tickets"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
                      {priorityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-16">No ticket data yet</p>
              )}
            </div>
          </div>

          {/* Row 4: Trend & Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase">Weekly Trend</h3>
              </div>
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendChartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={30} />
                    <Tooltip
                      formatter={(value) => [`${value}`, "Tickets Created"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tickets"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fill="url(#trendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-16">No trend data available yet</p>
              )}
            </div>

            {/* Category Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase">By Category</h3>
              </div>
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryChartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={30} />
                    <Tooltip
                      formatter={(value) => [`${value}`, "Tickets"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    />
                    <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-16">No category data yet</p>
              )}
            </div>
          </div>

          {/* Row 5: By Company (Ensuredit only) + SLA Details */}
          <div className={`grid grid-cols-1 ${isEnsuredit && companyChartData.length > 0 ? "lg:grid-cols-2" : ""} gap-6`}>
            {/* By Company — Ensuredit Only */}
            {isEnsuredit && companyChartData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700 uppercase">Open Tickets by Company</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={companyChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip
                      formatter={(value) => [`${value}`, "Open Tickets"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
                    />
                    <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* SLA & Response Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Performance Summary</h3>
              <div className="space-y-5">
                {/* SLA Gauge */}
                <div className={`${slaBg} rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">SLA Compliance Rate</span>
                    <span className={`text-2xl font-bold ${slaColor}`}>{slaRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        slaRate >= 90 ? "bg-green-500" : slaRate >= 70 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(slaRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats.slaCompliance.total - stats.slaCompliance.breached} within SLA / {stats.slaCompliance.total} total active
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Avg Response</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {stats.avgResponseTime > 0 ? `${stats.avgResponseTime}h` : "—"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Unassigned</p>
                    <p className={`text-xl font-bold mt-1 ${stats.unassigned > 0 ? "text-orange-600" : "text-gray-900"}`}>
                      {stats.unassigned}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Total Active</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{stats.open}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">All Tickets</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{stats.recentActivity}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 6: Recent Tickets Needing Attention */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 uppercase">Recent Tickets Needing Attention</h3>
              <button
                onClick={() => router.push("/tickets")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
              >
                View All <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {stats.recentTickets && stats.recentTickets.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.recentTickets.map((ticket) => {
                  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date()
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                      className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        isOverdue ? "border-l-4 border-red-400" : ""
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
                            <Badge className={PRIORITY_BADGE_COLORS[ticket.priority] || "bg-gray-100 text-gray-800"}>
                              {ticket.priority}
                            </Badge>
                            <Badge className={STATUS_BADGE_COLORS[ticket.status] || "bg-gray-100 text-gray-800"}>
                              {ticket.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1 truncate">{ticket.subject}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{ticket.company_name}</span>
                            <span>•</span>
                            <span>By {ticket.created_by_name}</span>
                            {ticket.assigned_to_name && (
                              <>
                                <span>•</span>
                                <span>→ {ticket.assigned_to_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500">{formatDate(ticket.created_at)}</p>
                          {ticket.due_date && (
                            <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                              Due: {formatDate(ticket.due_date)}
                            </p>
                          )}
                          {!ticket.assigned_to_name && (
                            <span className="inline-block mt-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-gray-500">All caught up! No open tickets.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
