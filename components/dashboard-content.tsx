"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import {
  Package,
  AlertCircle,
  Users,
  Building2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  MessageSquare,
  RefreshCw,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface DashboardData {
  totalIntegrations: number
  activeProjects: number
  overdueItems: number
  thisMonthGoLives: number
  totalUsers: number
  totalCompanies: number
  totalIssues: number
  raisedIssues: number
  inProgressIssues: number
  blockedIssues: number
  escalatedIssues: number
  resolvedIssues: number
  resolutionRate: number
  issuesUnder30Days: number
  issues30To45Days: number
  issues45To60Days: number
  issues60PlusDays: number
  statusChartData: Array<{ name: string; value: number; color: string }>
  agingChartData: Array<{ name: string; value: number; color: string }>
  topIssueCategories: Array<{ issue_category: string; count: number; resolution_rate: number }>
  pendingWithTeam: Array<{ name: string; pending_count: number; overdue_count: number }>
  recentEscalations: Array<{
    title: string
    issue_category: string
    priority: string
    updated_at: string
    company_name?: string
  }>
  recentActivity: Array<{
    title: string
    issue_category: string
    status: string
    updated_at: string
    company_name?: string
  }>
  userRole: string
  isCustomer: boolean
  isEnsuredit: boolean
}

export default function DashboardContent() {
  const { user, hasPermission } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      setError("")
      const response = await fetch("/api/dashboard-data")

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()
      console.log("Dashboard data received:", data)
      setDashboardData(data)
      setLastRefresh(new Date())
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      setError("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    setLoading(true)
    fetchDashboardData()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-80 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">No dashboard data available</p>
        </div>
      </div>
    )
  }

  const { isCustomer, isEnsuredit } = dashboardData

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isCustomer ? "Client Dashboard" : isEnsuredit ? "Ensuredit Dashboard" : "Dashboard"}
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {user?.name}! Here's your {isCustomer ? "account" : "project"} overview.
            </p>
            <p className="text-sm text-gray-500 mt-1">Last updated: {lastRefresh.toLocaleTimeString()}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Integrations</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.totalIntegrations}</p>
                <p className="text-sm text-blue-600">{dashboardData.activeProjects} active</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.totalIssues}</p>
                <p className="text-sm text-green-600">{dashboardData.resolutionRate}% resolved</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Escalated Issues</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.escalatedIssues}</p>
                <p className="text-sm text-red-600">Needs attention</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue Items</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.issues60PlusDays}</p>
                <p className="text-sm text-orange-600">60+ days old</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
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
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dashboardData.statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
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
                  <Bar dataKey="value" fill="#8884d8">
                    {dashboardData.agingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Categories and Team Workload */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Issue Categories */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issue Categories (Last 30 Days)</h3>
            <div className="space-y-4">
              {dashboardData.topIssueCategories.map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{category.issue_category}</span>
                    <div className="text-xs text-gray-500">
                      {category.count} issues • {category.resolution_rate}% resolved
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-600">{category.count}</span>
                    <div className="text-xs text-green-600">{category.resolution_rate}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Workload (Ensuredit only) */}
          {isEnsuredit && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Workload</h3>
              <div className="space-y-4">
                {dashboardData.pendingWithTeam.slice(0, 6).map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{member.name}</span>
                      <div className="text-xs text-gray-500">{member.overdue_count} overdue items</div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-600">{member.pending_count}</span>
                      <div className="text-xs text-red-600">{member.overdue_count} overdue</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* System Stats (Ensuredit only) */}
        {isEnsuredit && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
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

        {/* Recent Escalations */}
        {dashboardData.recentEscalations.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              Recent Escalations
            </h3>
            <div className="space-y-4">
              {dashboardData.recentEscalations.map((escalation, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 px-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex items-center">
                    <div className="bg-red-100 p-2 rounded-lg mr-4">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{escalation.title}</p>
                      <p className="text-xs text-gray-500">
                        {escalation.issue_category} •{" "}
                        {!isCustomer && escalation.company_name && `${escalation.company_name} • `}
                        {new Date(escalation.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-red-600 bg-red-100 px-3 py-1 rounded-full font-medium">
                    {escalation.priority} Priority
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 text-blue-600 mr-2" />
            Recent Activity
          </h3>
          <div className="space-y-4">
            {dashboardData.recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <div
                    className={`p-2 rounded-lg mr-4 ${
                      activity.status === "Resolved"
                        ? "bg-green-100"
                        : activity.status === "Escalated"
                          ? "bg-red-100"
                          : activity.status === "In Progress"
                            ? "bg-yellow-100"
                            : "bg-blue-100"
                    }`}
                  >
                    {activity.status === "Resolved" ? (
                      <CheckCircle
                        className={`w-4 h-4 ${
                          activity.status === "Resolved"
                            ? "text-green-600"
                            : activity.status === "Escalated"
                              ? "text-red-600"
                              : activity.status === "In Progress"
                                ? "text-yellow-600"
                                : "text-blue-600"
                        }`}
                      />
                    ) : (
                      <MessageSquare
                        className={`w-4 h-4 ${
                          activity.status === "Resolved"
                            ? "text-green-600"
                            : activity.status === "Escalated"
                              ? "text-red-600"
                              : activity.status === "In Progress"
                                ? "text-yellow-600"
                                : "text-blue-600"
                        }`}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-xs text-gray-500">
                      {activity.issue_category} •{" "}
                      {!isCustomer && activity.company_name && `${activity.company_name} • `}
                      {new Date(activity.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    activity.status === "Resolved"
                      ? "text-green-600 bg-green-100"
                      : activity.status === "Escalated"
                        ? "text-red-600 bg-red-100"
                        : activity.status === "In Progress"
                          ? "text-yellow-600 bg-yellow-100"
                          : activity.status === "Blocked"
                            ? "text-red-600 bg-red-100"
                            : "text-blue-600 bg-blue-100"
                  }`}
                >
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
