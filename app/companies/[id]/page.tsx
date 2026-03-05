"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Building2,
  Users,
  Package,
  MessageSquare,
  Calendar,
  Mail,
  Heart,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react"

interface CompanyDetail {
  company: {
    id: string
    name: string
    status: string
    customer_since: string
    ensuredit_lead_name: string
    client_lead_name: string
    client_lead_email: string
    notes: string
    user_count: number
    active_user_count: number
    created_at: string
  }
  integrations: {
    id: string
    status: string
    insurer_name: string
    product_name: string
    sub_product_name: string
    priority: string
    go_live_date: string
    go_live_planned_date: string
    updated_at: string
  }[]
  issues: {
    id: string
    title: string
    status: string
    priority: string
    issue_category: string
    insurer_name: string
    assigned_to_user_name: string
    updated_at: string
  }[]
  stats: {
    issues: { total: number; open: number; inProgress: number; escalated: number; resolved: number }
    integrations: { total: number; live: number; active: number }
    healthScore: number
  }
}

export default function CompanyDetailPage() {
  const { user, hasPermission } = useAuth()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [data, setData] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"integrations" | "issues">("integrations")

  useEffect(() => {
    if (user && id) {
      fetchCompany()
    }
  }, [user, id])

  const fetchCompany = async () => {
    try {
      const res = await fetch(`/api/companies/${id}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (error) {
      console.error("Error fetching company:", error)
    } finally {
      setLoading(false)
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getHealthBg = (score: number) => {
    if (score >= 80) return "bg-green-100"
    if (score >= 60) return "bg-yellow-100"
    return "bg-red-100"
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Active: "bg-green-100 text-green-800",
      Inactive: "bg-gray-100 text-gray-800",
      Onboarding: "bg-blue-100 text-blue-800",
      Prospect: "bg-purple-100 text-purple-800",
      Suspended: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const getIssueStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Raised: "bg-blue-100 text-blue-800",
      "In Progress": "bg-yellow-100 text-yellow-800",
      Blocked: "bg-red-100 text-red-800",
      Escalated: "bg-red-100 text-red-800",
      Resolved: "bg-green-100 text-green-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const getIntegrationStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Not Started": "bg-gray-100 text-gray-800",
      "API Kit Received": "bg-blue-100 text-blue-800",
      Development: "bg-yellow-100 text-yellow-800",
      "Internal Testing": "bg-orange-100 text-orange-800",
      "UAT in Progress": "bg-purple-100 text-purple-800",
      "Go Live": "bg-green-100 text-green-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  if (!hasPermission("companies")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to view companies.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Company Not Found</h1>
            <Button onClick={() => router.push("/companies")} variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Companies
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const { company, integrations, issues, stats } = data

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button onClick={() => router.push("/companies")} variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Companies
            </Button>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-4 rounded-xl">
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge className={getStatusColor(company.status)}>{company.status}</Badge>
                    {company.customer_since && (
                      <span className="text-sm text-gray-500">
                        Customer since {new Date(company.customer_since).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${getHealthBg(stats.healthScore)}`}>
                <Heart className={`h-5 w-5 ${getHealthColor(stats.healthScore)}`} />
                <div>
                  <p className="text-xs text-gray-600">Health Score</p>
                  <p className={`text-xl font-bold ${getHealthColor(stats.healthScore)}`}>{stats.healthScore}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-gray-500">Integrations</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.integrations.total}</p>
              <p className="text-xs text-green-600">{stats.integrations.live} live</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-gray-500">Total Issues</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.issues.total}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-xs text-gray-500">Open</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.issues.open}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-gray-500">Escalated</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.issues.escalated}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs text-gray-500">Resolved</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.issues.resolved}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                <span className="text-xs text-gray-500">Users</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{company.active_user_count}</p>
              <p className="text-xs text-gray-500">of {company.user_count}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Tabs */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab("integrations")}
                      className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "integrations"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Integrations ({integrations.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("issues")}
                      className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "issues"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Issues ({issues.length})
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === "integrations" ? (
                    <div className="space-y-3">
                      {integrations.length === 0 ? (
                        <p className="text-gray-500 text-center py-6">No integrations found.</p>
                      ) : (
                        integrations.map((intg) => (
                          <div key={intg.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {intg.insurer_name || "Unknown Insurer"}
                                </span>
                                <Badge className={getIntegrationStatusColor(intg.status)} variant="secondary">
                                  {intg.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {intg.product_name} / {intg.sub_product_name}
                              </p>
                            </div>
                            <div className="text-right">
                              {intg.go_live_date ? (
                                <p className="text-xs text-green-600">
                                  Live: {new Date(intg.go_live_date).toLocaleDateString()}
                                </p>
                              ) : intg.go_live_planned_date ? (
                                <p className="text-xs text-gray-500">
                                  Planned: {new Date(intg.go_live_planned_date).toLocaleDateString()}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.length === 0 ? (
                        <p className="text-gray-500 text-center py-6">No issues found.</p>
                      ) : (
                        issues.map((issue) => (
                          <button
                            key={issue.id}
                            onClick={() => router.push(`/issues/${issue.id}`)}
                            className="w-full text-left flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{issue.title}</span>
                                <Badge className={getIssueStatusColor(issue.status)} variant="secondary">
                                  {issue.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {issue.issue_category}
                                {issue.assigned_to_user_name && ` · Assigned to ${issue.assigned_to_user_name}`}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(issue.updated_at).toLocaleDateString()}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Company Info</h3>

                {company.ensuredit_lead_name && (
                  <div>
                    <p className="text-xs text-gray-500">EnsuredIt Lead</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{company.ensuredit_lead_name}</p>
                  </div>
                )}

                {company.client_lead_name && (
                  <div>
                    <p className="text-xs text-gray-500">Client Lead</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{company.client_lead_name}</p>
                    {company.client_lead_email && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{company.client_lead_email}</span>
                      </div>
                    )}
                  </div>
                )}

                {company.notes && (
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{company.notes}</p>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      Created {new Date(company.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
