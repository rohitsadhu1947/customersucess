"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart as BarChartIcon,
  Download,
  Filter,
  FileText,
  MessageSquare,
  Building2,
  Package,
  Clock,
  Shield,
  TrendingUp,
  GitBranch,
} from "lucide-react"
import { generateCSV, downloadCSV } from "@/lib/csv-export"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type ReportType =
  | "issues-summary"
  | "issues-by-company"
  | "integrations-status"
  | "resolution-time"
  | "sla-compliance"
  | "company-performance"
  | "integration-lifecycle"

interface ReportConfig {
  key: ReportType
  label: string
  description: string
  icon: typeof BarChartIcon
  adminOnly?: boolean
  ensureditOnly?: boolean
}

const REPORT_TYPES: ReportConfig[] = [
  { key: "issues-summary", label: "Issues Summary", description: "Breakdown of issues by category, status, and priority", icon: MessageSquare },
  { key: "issues-by-company", label: "Issues by Company", description: "Issue distribution across all companies", icon: Building2, adminOnly: true },
  { key: "integrations-status", label: "Integration Status", description: "Current status of all integration projects", icon: Package },
  { key: "resolution-time", label: "Resolution Time", description: "Average time to resolve issues by category", icon: Clock },
  { key: "sla-compliance", label: "SLA Compliance", description: "Due date compliance and overdue issue tracking", icon: Shield },
  { key: "company-performance", label: "Company Performance", description: "Issue and integration metrics per company", icon: TrendingUp, ensureditOnly: true },
  { key: "integration-lifecycle", label: "Integration Lifecycle", description: "Average duration of each development phase", icon: GitBranch },
]

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"]

interface SummaryStatProps {
  label: string
  value: string | number
  subtext?: string
  bg: string
}

function SummaryStat({ label, value, subtext, bg }: SummaryStatProps) {
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  )
}

export default function ReportsPage() {
  const { user, hasPermission } = useAuth()
  const [selectedReport, setSelectedReport] = useState<ReportType>("issues-summary")
  const [reportData, setReportData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const isCustomer = user?.role === "Customer" || user?.role === "Customer View Only"
  const isEnsuredit = user?.role === "Admin" || user?.role === "Ensuredit" || user?.role === "Ensuredit Client Lead"

  useEffect(() => {
    if (user) {
      fetchReport()
    }
  }, [user, selectedReport])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: selectedReport })
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)

      const res = await fetch(`/api/reports?${params.toString()}`)
      if (res.ok) {
        const result = await res.json()
        setReportData(result.data || [])
        setSummary(result.summary || null)
        setChartData(result.chartData || [])
      }
    } catch (error) {
      console.error("Error fetching report:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (reportData.length === 0) return

    const columns = Object.keys(reportData[0]).map((key) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }))

    const csvContent = generateCSV(reportData, columns)
    const timestamp = new Date().toISOString().split("T")[0]
    downloadCSV(csvContent, `report-${selectedReport}-${timestamp}.csv`)
  }

  const handleApplyFilters = () => {
    fetchReport()
  }

  if (!hasPermission("reports")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to view reports.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const availableReports = REPORT_TYPES.filter((r) => {
    if (r.adminOnly && isCustomer) return false
    if (r.ensureditOnly && !isEnsuredit) return false
    return true
  })

  const renderSummaryStats = () => {
    if (!summary) return null

    switch (selectedReport) {
      case "issues-summary":
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <SummaryStat label="Total Issues" value={summary.totalIssues} bg="bg-blue-50" />
            <SummaryStat label="Open / In Progress" value={summary.openIssues} bg="bg-amber-50" />
            <SummaryStat label="Escalated" value={summary.escalatedCount} bg="bg-red-50" />
            <SummaryStat label="Overdue" value={summary.overdueCount} bg="bg-orange-50" />
            <SummaryStat label="Resolution Rate" value={`${summary.resolutionRate}%`} bg="bg-green-50" />
            <SummaryStat label="Avg Resolution" value={`${summary.avgResolutionDays}d`} subtext="days" bg="bg-purple-50" />
          </div>
        )
      case "issues-by-company":
        return (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <SummaryStat label="Total Companies" value={summary.totalCompanies} bg="bg-blue-50" />
            <SummaryStat label="Avg Resolution Rate" value={`${summary.avgResolutionRate}%`} bg="bg-green-50" />
          </div>
        )
      case "integrations-status":
        return (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <SummaryStat label="Total Integrations" value={summary.totalIntegrations} bg="bg-blue-50" />
            <SummaryStat label="Go Live" value={summary.goLiveCount} bg="bg-green-50" />
            <SummaryStat label="In Progress" value={summary.activeCount} bg="bg-amber-50" />
          </div>
        )
      case "resolution-time":
        return (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <SummaryStat label="Avg Days" value={summary.avgDays} subtext="to resolve" bg="bg-blue-50" />
            <SummaryStat label="Fastest" value={`${summary.minDays}d`} bg="bg-green-50" />
            <SummaryStat label="Slowest" value={`${summary.maxDays}d`} bg="bg-red-50" />
          </div>
        )
      case "sla-compliance":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryStat label="With Due Date" value={summary.totalWithDueDate} bg="bg-blue-50" />
            <SummaryStat label="On Time" value={summary.onTimeResolved} bg="bg-green-50" />
            <SummaryStat label="Late Resolved" value={summary.lateResolved} bg="bg-amber-50" />
            <SummaryStat label="Compliance Rate" value={`${summary.overallComplianceRate}%`} subtext={`${summary.currentlyOverdue} currently overdue`} bg="bg-purple-50" />
          </div>
        )
      case "company-performance":
        return (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <SummaryStat label="Active Companies" value={summary.totalCompanies} bg="bg-blue-50" />
            <SummaryStat label="Avg Resolution Rate" value={`${summary.avgResolutionRate}%`} bg="bg-green-50" />
            <SummaryStat label="Live Integrations" value={summary.totalLiveIntegrations} bg="bg-purple-50" />
          </div>
        )
      case "integration-lifecycle":
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryStat label="Total Projects" value={summary.totalProjects} bg="bg-blue-50" />
            <SummaryStat label="Avg Dev Days" value={summary.avgDevDays} bg="bg-indigo-50" />
            <SummaryStat label="Avg Testing Days" value={summary.avgTestingDays} bg="bg-amber-50" />
            <SummaryStat label="Avg UAT Days" value={summary.avgUatDays} bg="bg-green-50" />
          </div>
        )
      default:
        return null
    }
  }

  const renderChart = () => {
    if (!chartData || chartData.length === 0) return null

    switch (selectedReport) {
      case "issues-summary": {
        // Stacked bar chart by category
        const allStatuses = new Set<string>()
        for (const item of chartData) {
          for (const key of Object.keys(item)) {
            if (key !== "category") allStatuses.add(key)
          }
        }
        const statusArray = Array.from(allStatuses)

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Issues by Category & Status</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                {statusArray.map((status, i) => (
                  <Bar key={status} dataKey={status} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      case "issues-by-company": {
        // Horizontal bar chart
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Issues by Company</h3>
            <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#3B82F6" name="Total" />
                <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
                <Bar dataKey="escalated" fill="#EF4444" name="Escalated" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      case "integrations-status": {
        // Donut pie chart
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Integration Status Distribution</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )
      }

      case "resolution-time": {
        // Bar chart
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Resolution Time by Category (days)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgDays" fill="#3B82F6" name="Avg Days" />
                <Bar dataKey="minDays" fill="#10B981" name="Min Days" />
                <Bar dataKey="maxDays" fill="#EF4444" name="Max Days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      case "sla-compliance": {
        // Donut pie chart
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">SLA Compliance Breakdown</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )
      }

      case "company-performance": {
        // Horizontal bar chart
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Company Performance Overview</h3>
            <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#3B82F6" name="Total Issues" />
                <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
                <Bar dataKey="escalated" fill="#EF4444" name="Escalated" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      case "integration-lifecycle": {
        // Grouped bar chart
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Average Phase Duration by Status (days)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="devDays" fill="#3B82F6" name="Dev Days" />
                <Bar dataKey="testingDays" fill="#8B5CF6" name="Testing Days" />
                <Bar dataKey="uatDays" fill="#F59E0B" name="UAT Days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600 mt-2">Generate and export reports for analysis</p>
            </div>
            <Button onClick={handleExportCSV} disabled={reportData.length === 0} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Report Types */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Report Type</h3>
              {availableReports.map((report) => {
                const Icon = report.icon
                return (
                  <button
                    key={report.key}
                    onClick={() => setSelectedReport(report.key)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedReport === report.key
                        ? "bg-blue-50 border-blue-200 shadow-sm"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${selectedReport === report.key ? "text-blue-600" : "text-gray-400"}`} />
                      <div>
                        <p className={`text-sm font-medium ${selectedReport === report.key ? "text-blue-900" : "text-gray-900"}`}>
                          {report.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}

              {/* Date Filters */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Date Range
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <Button onClick={handleApplyFilters} className="w-full" size="sm">
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Report Header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <h2 className="text-lg font-semibold text-gray-900">
                        {availableReports.find((r) => r.key === selectedReport)?.label}
                      </h2>
                    </div>
                    <Badge variant="secondary">{reportData.length} records</Badge>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-12 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : reportData.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <BarChartIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No data available for this report.</p>
                  <p className="text-sm text-gray-400 mt-1">Try adjusting the date range.</p>
                </div>
              ) : (
                <>
                  {/* Summary Stats */}
                  {renderSummaryStats()}

                  {/* Chart */}
                  {renderChart()}

                  {/* Data Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700">Detailed Data</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            {Object.keys(reportData[0]).map((key) => (
                              <TableHead key={key} className="whitespace-nowrap text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map((row, index) => (
                            <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                              {Object.entries(row).map(([key, value]) => (
                                <TableCell key={key} className="whitespace-nowrap text-sm">
                                  {key === "resolution_rate" || key === "avg_resolution_days" || key === "avg_days" || key === "min_days" || key === "max_days" || key === "avg_dev_days" || key === "avg_testing_days" || key === "avg_uat_days"
                                    ? value !== null ? `${Number(value).toFixed(1)}${key === "resolution_rate" ? "%" : " days"}` : "N/A"
                                    : key === "status" || key === "priority"
                                      ? <Badge variant="secondary">{String(value)}</Badge>
                                      : String(value ?? "")}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
