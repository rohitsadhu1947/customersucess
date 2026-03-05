"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import {
  Package,
  AlertCircle,
  Users,
  Building2,
  Clock,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Ticket,
  CheckCircle,
  ShieldAlert,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts"

// ── Existing interfaces ──

interface StatusChartDataItem {
  name: string
  value: number
  color: string
}

interface AgingChartDataItem {
  name: string
  value: number
}

interface IssueCategoryItem {
  issue_category: string
  count: number
  resolution_rate: number
}

interface PendingWithTeamItem {
  name: string
  pending_count: number
  overdue_count: number
}

interface RecentEscalationItem {
  title: string
  issue_category: string
  company_name: string
  updated_at: string
  priority: string
}

interface RecentActivityItem {
  title: string
  issue_category: string
  updated_at: string
  status: string
}

// ── New enhanced interfaces ──

interface TrendPoint {
  month: string
  count: number
}

interface TrendsData {
  issuesCreated: TrendPoint[]
  issuesResolved: TrendPoint[]
  goLives: TrendPoint[]
}

interface PeriodComparison {
  issuesThisMonth: number
  issuesLastMonth: number
  issuesChange: number
  escalationsThisMonth: number
  escalationsLastMonth: number
  escalationsChange: number
  integrationsThisMonth: number
  integrationsLastMonth: number
  integrationsChange: number
}

interface PipelineStage {
  stage: string
  count: number
  percentage: number
}

interface OverdueIssue {
  id: number
  title: string
  company_name: string
  due_date: string
  days_overdue: number
  priority: string
}

interface SlaTracking {
  approaching: number
  overdue: number
  overdueIssues: OverdueIssue[]
}

interface CompanyHealth {
  id: number
  name: string
  healthScore: number
  openIssues: number
  escalatedIssues: number
  liveIntegrations: number
  totalIntegrations: number
}

// ── Ticket Stats interface ──

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
  weeklyTrend: { week: string; count: number }[]
  recentTickets: {
    id: string
    ticket_number: string
    subject: string
    priority: string
    status: string
    company_name: string
    assigned_to_name: string | null
    created_at: string
    due_date: string | null
  }[]
}

const TICKET_STATUS_COLORS: Record<string, string> = {
  New: "#9CA3AF",
  Open: "#3B82F6",
  "In Progress": "#6366F1",
  "Waiting on Customer": "#F59E0B",
  "Waiting on Internal": "#A855F7",
  Escalated: "#EF4444",
  Resolved: "#22C55E",
  Closed: "#6B7280",
}

const TICKET_PRIORITY_BADGE: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-blue-100 text-blue-800",
  Low: "bg-gray-100 text-gray-800",
}

const TICKET_STATUS_BADGE: Record<string, string> = {
  New: "bg-gray-100 text-gray-800",
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-indigo-100 text-indigo-800",
  "Waiting on Customer": "bg-amber-100 text-amber-800",
  "Waiting on Internal": "bg-purple-100 text-purple-800",
  Escalated: "bg-red-100 text-red-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-800",
}

// ── Pipeline stage color mapping ──

const PIPELINE_COLORS: Record<string, string> = {
  "Not Started": "#9CA3AF",
  "API Kit": "#60A5FA",
  Development: "#3B82F6",
  "Internal Testing": "#F59E0B",
  UAT: "#8B5CF6",
  "UAT in Progress": "#8B5CF6",
  "Go Live": "#10B981",
}

function getPipelineColor(stage: string): string {
  return PIPELINE_COLORS[stage] || "#6B7280"
}

// ── Health score color helper ──

function getHealthColor(score: number): string {
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-yellow-600"
  return "text-red-600"
}

function getHealthBg(score: number): string {
  if (score >= 80) return "bg-green-50 border-green-200"
  if (score >= 60) return "bg-yellow-50 border-yellow-200"
  return "bg-red-50 border-red-200"
}

// ── Priority badge helper ──

function getPriorityClasses(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "critical":
      return "text-red-700 bg-red-100"
    case "high":
      return "text-orange-700 bg-orange-100"
    case "medium":
      return "text-yellow-700 bg-yellow-100"
    default:
      return "text-gray-700 bg-gray-100"
  }
}

// ── Sparkline component ──

function Sparkline({
  data,
  color,
  fillColor,
}: {
  data: TrendPoint[]
  color: string
  fillColor: string
}) {
  if (!data || data.length === 0) return null
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${color.replace("#", "")})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Trend comparison text component ──

function TrendBadge({ change, label }: { change: number | undefined; label?: string }) {
  if (change === undefined || change === null) return null
  const isPositive = change >= 0
  // For issues/escalations, an increase is bad (red), decrease is good (green)
  // We just show the direction with sign
  const colorClass = isPositive ? "text-red-600" : "text-green-600"
  const Icon = isPositive ? TrendingUp : TrendingDown
  const sign = isPositive ? "+" : ""
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {sign}
      {change}% {label || "vs last month"}
    </span>
  )
}

function TrendBadgeInverse({ change, label }: { change: number | undefined; label?: string }) {
  // For integrations/go-lives, increase is good (green)
  if (change === undefined || change === null) return null
  const isPositive = change >= 0
  const colorClass = isPositive ? "text-green-600" : "text-red-600"
  const Icon = isPositive ? TrendingUp : TrendingDown
  const sign = isPositive ? "+" : ""
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {sign}
      {change}% {label || "vs last month"}
    </span>
  )
}

// ── Main Dashboard ──

export default function Home() {
  const { user, hasPermission } = useAuth()
  const router = useRouter()
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardData, setDashboardData] = useState({
    // Existing fields
    totalIntegrations: 0,
    activeProjects: 0,
    overdueItems: 0,
    thisMonthGoLives: 0,
    totalUsers: 0,
    totalCompanies: 0,
    totalIssues: 0,
    raisedIssues: 0,
    inProgressIssues: 0,
    blockedIssues: 0,
    escalatedIssues: 0,
    resolvedIssues: 0,
    resolutionRate: 0,
    issuesUnder30Days: 0,
    issues30To45Days: 0,
    issues45To60Days: 0,
    issues60PlusDays: 0,
    statusChartData: [] as StatusChartDataItem[],
    agingChartData: [] as AgingChartDataItem[],
    topIssueCategories: [] as IssueCategoryItem[],
    pendingWithTeam: [] as PendingWithTeamItem[],
    recentEscalations: [] as RecentEscalationItem[],
    recentActivity: [] as RecentActivityItem[],
    userRole: "",
    isCustomer: false,
    isEnsuredit: false,
    // New enhanced fields
    trends: null as TrendsData | null,
    periodComparison: null as PeriodComparison | null,
    pipelineOverview: [] as PipelineStage[],
    slaTracking: null as SlaTracking | null,
    companyHealthOverview: [] as CompanyHealth[],
  })
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchTicketStats = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets/stats")
      if (res.ok) setTicketStats(await res.json())
    } catch (error) {
      console.error("Error fetching ticket stats:", error)
    }
  }, [])

  const fetchDashboardData = useCallback(async () => {
    try {
      setError("")
      setRefreshing(true)

      const response = await fetch("/api/dashboard-data")

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      // Format percentages to 2 decimal places
      if (data.topIssueCategories) {
        data.topIssueCategories = data.topIssueCategories.map((category: IssueCategoryItem) => ({
          ...category,
          resolution_rate: Number(Number(category.resolution_rate || 0).toFixed(2)),
        }))
      }

      // Format main resolution rate
      data.resolutionRate = Number(Number.parseFloat(data.resolutionRate || 0).toFixed(2))

      // Ensure all arrays are properly set with fallbacks
      setDashboardData({
        ...data,
        statusChartData: data.statusChartData || [],
        agingChartData: data.agingChartData || [],
        topIssueCategories: data.topIssueCategories || [],
        pendingWithTeam: data.pendingWithTeam || [],
        recentEscalations: data.recentEscalations || [],
        recentActivity: data.recentActivity || [],
        // New enhanced fields with fallbacks
        trends: data.trends || null,
        periodComparison: data.periodComparison || null,
        pipelineOverview: data.pipelineOverview || [],
        slaTracking: data.slaTracking || null,
        companyHealthOverview: data.companyHealthOverview || [],
      })
    } catch (error: unknown) {
      console.error("Error fetching dashboard data:", error)
      setError(`Failed to load dashboard: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchDashboardData()
      fetchTicketStats()
      // Auto-refresh every 5 minutes
      const interval = setInterval(() => {
        fetchDashboardData()
        fetchTicketStats()
      }, 300000)
      return () => clearInterval(interval)
    }
  }, [user, fetchDashboardData, fetchTicketStats])

  // Format percentage for display
  const formatPercent = (value: number) => {
    return `${Number(Number(value || 0).toFixed(2))}%`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80 bg-gray-200 rounded-xl"></div>
              <div className="h-80 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Dashboard Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={fetchDashboardData}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const { isCustomer, isEnsuredit, trends, periodComparison, pipelineOverview, slaTracking, companyHealthOverview } =
    dashboardData

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isCustomer ? "Client Dashboard" : isEnsuredit ? "Ensuredit Management Dashboard" : "Dashboard"}
              </h1>
              <p className="text-gray-600 mt-2">
                Welcome back, {user?.name}! Here&apos;s your {isCustomer ? "account" : "project"} overview.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastRefresh && (
                <span className="text-xs text-gray-400">Updated {lastRefresh.toLocaleTimeString()}</span>
              )}
              <button
                onClick={fetchDashboardData}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                title="Refresh dashboard"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* ═══════════ Row 1: KPI Cards with Sparklines ═══════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Card 1: Total Integrations */}
            <button
              onClick={() => router.push("/integrations")}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Integrations</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.totalIntegrations}</p>
                  </div>
                </div>
                {trends?.goLives && trends.goLives.length > 0 && (
                  <Sparkline data={trends.goLives} color="#3B82F6" fillColor="#3B82F6" />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-blue-600">{dashboardData.activeProjects} active projects</p>
                {periodComparison && (
                  <TrendBadgeInverse change={periodComparison.integrationsChange} />
                )}
              </div>
            </button>

            {/* Card 2: Total Issues */}
            <button
              onClick={() => router.push("/issues")}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-green-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Issues</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.totalIssues}</p>
                  </div>
                </div>
                {trends?.issuesCreated && trends.issuesCreated.length > 0 && (
                  <Sparkline data={trends.issuesCreated} color="#10B981" fillColor="#10B981" />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-green-600">
                  {formatPercent(dashboardData.resolutionRate)} resolution rate
                </p>
                {periodComparison && <TrendBadge change={periodComparison.issuesChange} />}
              </div>
            </button>

            {/* Card 3: Escalated Issues */}
            <button
              onClick={() => router.push("/issues")}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-orange-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Escalated Issues</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.escalatedIssues}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-orange-600">Needs attention</p>
                {periodComparison && <TrendBadge change={periodComparison.escalationsChange} />}
              </div>
            </button>

            {/* Card 4: Overdue Items */}
            <button
              onClick={() => router.push("/reports")}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-red-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <Clock className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Overdue Items</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.issues60PlusDays}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-red-600">60+ days old</p>
              </div>
            </button>
          </div>

          {/* ═══════════ Row 2 (Ensuredit only): Users + Companies ═══════════ */}
          {isEnsuredit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="bg-indigo-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.totalUsers}</p>
                    <p className="text-sm text-indigo-600">Across all companies</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Building2 className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Companies</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardData.totalCompanies}</p>
                    <p className="text-sm text-purple-600">Active clients</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ Row 3: Pipeline Overview ═══════════ */}
          {pipelineOverview && pipelineOverview.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Integration Pipeline</h3>
              {/* Segmented bar */}
              <div className="w-full h-10 rounded-lg overflow-hidden flex">
                {pipelineOverview.map((stage) => (
                  <div
                    key={stage.stage}
                    className="h-full relative group transition-all"
                    style={{
                      width: `${Math.max(stage.percentage, 2)}%`,
                      backgroundColor: getPipelineColor(stage.stage),
                    }}
                    title={`${stage.stage}: ${stage.count} (${stage.percentage}%)`}
                  >
                    {stage.percentage >= 8 && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white drop-shadow-sm">
                        {stage.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Labels row */}
              <div className="mt-4 flex flex-wrap gap-4">
                {pipelineOverview.map((stage) => (
                  <div key={stage.stage} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: getPipelineColor(stage.stage) }}
                    />
                    <span className="text-sm text-gray-700">
                      {stage.stage}{" "}
                      <span className="font-semibold text-gray-900">
                        {stage.count}
                      </span>{" "}
                      <span className="text-gray-400">({stage.percentage}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ Row 4: SLA Tracker + Quick Actions ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* SLA Tracker */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">SLA Tracker</h3>
              {slaTracking ? (
                <>
                  <div className="flex gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      <Clock className="w-3.5 h-3.5" />
                      {slaTracking.approaching} Approaching
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {slaTracking.overdue} Overdue
                    </span>
                  </div>
                  {slaTracking.overdueIssues && slaTracking.overdueIssues.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {slaTracking.overdueIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                          onClick={() => router.push(`/issues/${issue.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                            <p className="text-xs text-gray-500">
                              {issue.company_name} &middot; {issue.days_overdue} days overdue
                            </p>
                          </div>
                          <span
                            className={`ml-3 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${getPriorityClasses(issue.priority)}`}
                          >
                            {issue.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No overdue issues currently</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">Set due dates on issues for SLA tracking</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {isEnsuredit && (
                  <>
                    <button
                      onClick={() => router.push("/integrations")}
                      className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                          <Plus className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">New Integration</p>
                          <p className="text-xs text-gray-500">Track a new integration project</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </button>
                    <button
                      onClick={() => router.push("/issues")}
                      className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                          <Plus className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">New Issue</p>
                          <p className="text-xs text-gray-500">Log a new project issue</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                    </button>
                  </>
                )}
                {isCustomer && (
                  <button
                    onClick={() => router.push("/issues")}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-100 p-2 rounded-lg group-hover:bg-orange-200 transition-colors">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">Report Issue</p>
                        <p className="text-xs text-gray-500">Report a new issue</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                  </button>
                )}
                <button
                  onClick={() => router.push("/reports")}
                  className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                      <ArrowRight className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">View Reports</p>
                      <p className="text-xs text-gray-500">Analytics and reporting</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
                </button>
              </div>
            </div>
          </div>

          {/* ═══════════ Row 4.5: Ticket Overview ═══════════ */}
          {hasPermission("tickets") && ticketStats && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Ticket Overview</h3>
                </div>
                <button
                  onClick={() => router.push("/ticket-dashboard")}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                >
                  Full Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ticket KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">Open</p>
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{ticketStats.open}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ticketStats.unassigned} unassigned</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">My Tickets</p>
                    <Ticket className="h-4 w-4 text-indigo-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{ticketStats.myTickets}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Assigned / created</p>
                </div>

                <div className={`bg-white rounded-xl shadow-sm border ${ticketStats.overdue > 0 ? "border-red-200" : "border-gray-200"} p-4`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">Overdue</p>
                    <Clock className={`h-4 w-4 ${ticketStats.overdue > 0 ? "text-red-500" : "text-gray-400"}`} />
                  </div>
                  <p className={`text-2xl font-bold mt-1 ${ticketStats.overdue > 0 ? "text-red-600" : "text-gray-900"}`}>{ticketStats.overdue}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Past due date</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500">SLA Compliance</p>
                    <CheckCircle className={`h-4 w-4 ${ticketStats.slaCompliance.rate >= 90 ? "text-green-500" : ticketStats.slaCompliance.rate >= 70 ? "text-yellow-500" : "text-red-500"}`} />
                  </div>
                  <p className={`text-2xl font-bold mt-1 ${ticketStats.slaCompliance.rate >= 90 ? "text-green-600" : ticketStats.slaCompliance.rate >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                    {ticketStats.slaCompliance.rate}%
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{ticketStats.slaCompliance.breached} breached</p>
                </div>
              </div>

              {/* Ticket Charts + Recent Tickets */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Donut */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">By Status</h4>
                  {ticketStats.byStatus.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={ticketStats.byStatus.map(s => ({ name: s.status, value: Number(s.count), color: TICKET_STATUS_COLORS[s.status] || "#9CA3AF" }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {ticketStats.byStatus.map((s, i) => (
                              <Cell key={i} fill={TICKET_STATUS_COLORS[s.status] || "#9CA3AF"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value}`, "Tickets"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-2">
                        {ticketStats.byStatus.slice(0, 4).map(s => (
                          <div key={s.status} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TICKET_STATUS_COLORS[s.status] || "#9CA3AF" }} />
                              <span className="text-gray-600">{s.status}</span>
                            </div>
                            <span className="font-semibold text-gray-900">{Number(s.count)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-400 text-center py-12 text-sm">No tickets yet</p>
                  )}
                </div>

                {/* Weekly Trend */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Weekly Trend</h4>
                  {ticketStats.weeklyTrend && ticketStats.weeklyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={ticketStats.weeklyTrend.map(t => ({ name: new Date(t.week).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), tickets: Number(t.count) }))} margin={{ left: -10, right: 5, top: 5, bottom: 5 }}>
                        <defs>
                          <linearGradient id="ticketTrendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                        <Tooltip formatter={(value) => [`${value}`, "Created"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Area type="monotone" dataKey="tickets" stroke="#3B82F6" strokeWidth={2} fill="url(#ticketTrendGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-400 text-center py-12 text-sm">No trend data yet</p>
                  )}
                </div>

                {/* Recent Tickets */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">Needs Attention</h4>
                    <button
                      onClick={() => router.push("/tickets")}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  {ticketStats.recentTickets && ticketStats.recentTickets.length > 0 ? (
                    <div className="space-y-2.5">
                      {ticketStats.recentTickets.slice(0, 4).map(t => {
                        const isOverdue = t.due_date && new Date(t.due_date) < new Date()
                        return (
                          <div
                            key={t.id}
                            onClick={() => router.push(`/tickets/${t.id}`)}
                            className={`p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${isOverdue ? "border-red-200 bg-red-50/50" : "border-gray-100"}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-mono text-gray-400">{t.ticket_number}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${TICKET_PRIORITY_BADGE[t.priority] || "bg-gray-100 text-gray-800"}`}>
                                {t.priority}
                              </Badge>
                              <Badge className={`text-[10px] px-1.5 py-0 ${TICKET_STATUS_BADGE[t.status] || "bg-gray-100 text-gray-800"}`}>
                                {t.status}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-gray-900 truncate">{t.subject}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {t.company_name}{t.assigned_to_name ? ` → ${t.assigned_to_name}` : " · Unassigned"}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">All caught up!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ Row 5: Existing Pie + Bar Charts (KEPT AS-IS) ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Issue Status Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue Status Distribution</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }: any) =>
                        `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(dashboardData.statusChartData || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Issue Aging Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue Aging Analysis</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={dashboardData.agingChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ═══════════ Row 6: Existing Top Categories + Team Workload (KEPT AS-IS) ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Issue Categories */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issue Categories (Last 30 Days)</h3>
              <div className="space-y-4">
                {(dashboardData.topIssueCategories || []).length > 0 ? (
                  (dashboardData.topIssueCategories || []).map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{category.issue_category}</span>
                        <div className="text-xs text-gray-500">
                          {category.count} issues &bull; {formatPercent(category.resolution_rate)} resolved
                        </div>
                      </div>
                      <span className="text-lg font-bold text-gray-600">{category.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No issue categories in the last 30 days</p>
                )}
              </div>
            </div>

            {/* Team Workload or Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {isEnsuredit ? "Team Workload" : "Recent Activity"}
              </h3>
              <div className="space-y-4">
                {isEnsuredit ? (
                  (dashboardData.pendingWithTeam || []).length > 0 ? (
                    (dashboardData.pendingWithTeam || [])
                      .slice(0, 5)
                      .map((member, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{member.name}</span>
                            <div className="text-xs text-gray-500">{member.overdue_count} overdue items</div>
                          </div>
                          <span className="text-lg font-bold text-gray-600">{member.pending_count}</span>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No pending team assignments</p>
                  )
                ) : (dashboardData.recentActivity || []).length > 0 ? (
                  (dashboardData.recentActivity || [])
                    .slice(0, 5)
                    .map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{activity.title}</span>
                          <div className="text-xs text-gray-500">
                            {activity.issue_category} &bull; {new Date(activity.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            activity.status === "Resolved"
                              ? "text-green-600 bg-green-100"
                              : activity.status === "Escalated"
                                ? "text-red-600 bg-red-100"
                                : activity.status === "In Progress"
                                  ? "text-yellow-600 bg-yellow-100"
                                  : "text-blue-600 bg-blue-100"
                          }`}
                        >
                          {activity.status}
                        </span>
                      </div>
                    ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════ Row 7 (Ensuredit only): Company Health Strip ═══════════ */}
          {isEnsuredit && companyHealthOverview && companyHealthOverview.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Health Overview</h3>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {companyHealthOverview.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => router.push(`/companies/${company.id}`)}
                    className={`flex-shrink-0 w-56 rounded-xl border p-4 hover:shadow-md transition-all text-left ${getHealthBg(company.healthScore)}`}
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate" title={company.name}>
                      {company.name}
                    </p>
                    <div className="mt-2 flex items-end justify-between">
                      <div>
                        <p className={`text-2xl font-bold ${getHealthColor(company.healthScore)}`}>
                          {company.healthScore}
                        </p>
                        <p className="text-xs text-gray-500">Health Score</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{company.openIssues} open</p>
                        {company.escalatedIssues > 0 && (
                          <p className="text-xs text-red-600 font-medium">{company.escalatedIssues} escalated</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {company.liveIntegrations}/{company.totalIntegrations} live
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ Row 8: Existing Recent Escalations (KEPT AS-IS) ═══════════ */}
          {(dashboardData.recentEscalations || []).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Escalations</h3>
              <div className="space-y-4">
                {(dashboardData.recentEscalations || []).map((escalation, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center">
                      <div className="bg-red-100 p-2 rounded-lg mr-4">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{escalation.title}</p>
                        <p className="text-xs text-gray-500">
                          {escalation.issue_category} &bull; {!isCustomer && `${escalation.company_name} \u2022 `}
                          {new Date(escalation.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">
                      {escalation.priority} Priority
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
