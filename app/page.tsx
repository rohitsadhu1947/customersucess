"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Package, AlertCircle, Users, Building2, Clock, AlertTriangle, MessageSquare } from "lucide-react"
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
} from "recharts"

export default function Home() {
  const { user, hasPermission } = useAuth()
  const [dashboardData, setDashboardData] = useState({
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
    statusChartData: [],
    agingChartData: [],
    topIssueCategories: [],
    pendingWithTeam: [],
    recentEscalations: [],
    recentActivity: [],
    userRole: "",
    isCustomer: false,
    isEnsuredit: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      setError("")
      console.log("Fetching dashboard data...")

      const response = await fetch("/api/dashboard-data")

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log("Dashboard data received:", data)

      // Format percentages to 2 decimal places
      if (data.topIssueCategories) {
        data.topIssueCategories = data.topIssueCategories.map((category) => ({
          ...category,
          resolution_rate: Number(Number.parseFloat(category.resolution_rate || 0).toFixed(2)),
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
      })
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      setError(`Failed to load dashboard: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Format percentage for display
  const formatPercent = (value) => {
    return `${Number(Number.parseFloat(value || 0).toFixed(2))}%`
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

  const { isCustomer, isEnsuredit } = dashboardData

  return (
    <DashboardLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {isCustomer ? "Client Dashboard" : isEnsuredit ? "Ensuredit Management Dashboard" : "Dashboard"}
            </h1>
            <p className="text-gray-600 mt-2">
              Welcome back, {user?.name}! Here's your {isCustomer ? "account" : "project"} overview.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Integrations</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.totalIntegrations}</p>
                  <p className="text-sm text-blue-600">{dashboardData.activeProjects} active projects</p>
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
                  <p className="text-sm text-green-600">
                    {formatPercent(dashboardData.resolutionRate)} resolution rate
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Escalated Issues</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.escalatedIssues}</p>
                  <p className="text-sm text-orange-600">Needs attention</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="bg-red-100 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overdue Items</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.issues60PlusDays}</p>
                  <p className="text-sm text-red-600">60+ days old</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
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
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
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

          {/* Data Tables Row */}
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
                          {category.count} issues • {formatPercent(category.resolution_rate)} resolved
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
                    (dashboardData.pendingWithTeam || []).slice(0, 5).map((member, index) => (
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
                  (dashboardData.recentActivity || []).slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{activity.title}</span>
                        <div className="text-xs text-gray-500">
                          {activity.issue_category} • {new Date(activity.updated_at).toLocaleDateString()}
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

          {/* System Stats (Ensuredit only) */}
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

          {/* Recent Escalations */}
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
                          {escalation.issue_category} • {!isCustomer && `${escalation.company_name} • `}
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
