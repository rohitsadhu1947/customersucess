"use client"

import { useAuth } from "@/lib/auth-context"
import DashboardLayout from "@/components/dashboard-layout"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Heart,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

interface CompanyHealth {
  id: string
  name: string
  status: string
  customerSince: string | null
  ensureditLeadName: string | null
  totalIntegrations: number
  liveIntegrations: number
  activeIntegrations: number
  totalIssues: number
  openIssues: number
  escalatedIssues: number
  resolvedIssues: number
  healthScore: number
  resolutionRate: number
  trend: "up" | "down" | "stable"
}

interface HealthSummary {
  totalCompanies: number
  healthyCount: number
  atRiskCount: number
  criticalCount: number
  avgHealthScore: number
}

interface HealthResponse {
  companies: CompanyHealth[]
  summary: HealthSummary
  redirect?: string
}

type SortOption = "health" | "issues" | "integrations" | "name"

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-amber-600"
  return "text-red-600"
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500"
  if (score >= 60) return "bg-amber-500"
  return "bg-red-500"
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-50 border-green-200"
  if (score >= 60) return "bg-amber-50 border-amber-200"
  return "bg-red-50 border-red-200"
}

export default function CompanyHealthPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyHealth[]>([])
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>("health")

  useEffect(() => {
    if (!user) return

    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/companies/health")
        if (!res.ok) throw new Error("Failed to fetch")
        const data: HealthResponse = await res.json()

        // Customer redirect
        if (data.redirect) {
          router.push(data.redirect)
          return
        }

        setCompanies(data.companies)
        setSummary(data.summary)
      } catch (error) {
        console.error("Error fetching company health:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
  }, [user, router])

  // Customer role banner + redirect
  if (user && (user.role === "Customer" || user.role === "Customer View Only")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting to your company page...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const sortedCompanies = [...companies].sort((a, b) => {
    switch (sortBy) {
      case "health":
        return a.healthScore - b.healthScore // ascending, worst first
      case "issues":
        return b.openIssues - a.openIssues // descending, most issues first
      case "integrations":
        return b.totalIntegrations - a.totalIntegrations // descending
      case "name":
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header skeleton */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mt-2"></div>
              </div>
              <div className="h-10 w-24 bg-gray-200 rounded-full animate-pulse"></div>
            </div>

            {/* Summary skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse"></div>
              ))}
            </div>

            {/* Cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-3"></div>
                  <div className="h-3 w-full bg-gray-200 rounded-full animate-pulse mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-44 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-36 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Company Health Overview</h1>
              <p className="text-gray-600 mt-1">Monitor the health and status of all active companies</p>
            </div>
            {summary && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${getScoreBgColor(summary.avgHealthScore)}`}>
                <Heart className={`h-5 w-5 ${getScoreColor(summary.avgHealthScore)}`} />
                <span className={`text-lg font-bold ${getScoreColor(summary.avgHealthScore)}`}>
                  {summary.avgHealthScore}
                </span>
                <span className="text-sm text-gray-600">avg</span>
              </div>
            )}
          </div>

          {/* Summary Bar */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-700">{summary.healthyCount}</p>
                  <p className="text-sm text-green-600">Healthy (Score &ge; 80)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-amber-700">{summary.atRiskCount}</p>
                  <p className="text-sm text-amber-600">At Risk (Score 60-79)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-700">{summary.criticalCount}</p>
                  <p className="text-sm text-red-600">Critical (Score &lt; 60)</p>
                </div>
              </div>
            </div>
          )}

          {/* Sort Controls */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-gray-500">
              {companies.length} active {companies.length === 1 ? "company" : "companies"}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-sm text-gray-600">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="health">Health Score</option>
                <option value="issues">Open Issues</option>
                <option value="integrations">Total Integrations</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {/* Company Cards Grid */}
          {sortedCompanies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedCompanies.map((company) => (
                <div
                  key={company.id}
                  className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-lg transition-shadow ${getScoreBgColor(company.healthScore).split(" ")[1]}`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight">{company.name}</h3>
                    <span className={`text-2xl font-bold ${getScoreColor(company.healthScore)} ml-2 flex-shrink-0`}>
                      {company.healthScore}
                    </span>
                  </div>

                  {company.ensureditLeadName && (
                    <p className="text-sm text-gray-500 mb-3">
                      Ensuredit Lead: {company.ensureditLeadName}
                    </p>
                  )}

                  {/* Health Score Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                      className={`h-2 rounded-full transition-all ${getScoreBarColor(company.healthScore)}`}
                      style={{ width: `${company.healthScore}%` }}
                    ></div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span>
                        {company.totalIntegrations} integrations ({company.liveIntegrations} live)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                      <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${company.escalatedIssues > 0 ? "text-red-500" : "text-gray-400"}`} />
                      <span>
                        {company.openIssues} open issues
                        {company.escalatedIssues > 0 && (
                          <span className="text-red-600 font-medium">, {company.escalatedIssues} escalated</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className={`h-4 w-4 flex-shrink-0 ${company.resolutionRate >= 70 ? "text-green-500" : "text-gray-400"}`} />
                      <span>{company.resolutionRate}% resolution rate</span>
                    </div>
                  </div>

                  {/* Footer: Trend + View Button */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-1.5 text-sm">
                      {company.trend === "up" && (
                        <>
                          <TrendingUp className="h-4 w-4 text-red-500" />
                          <span className="text-red-600 font-medium">Worsening</span>
                        </>
                      )}
                      {company.trend === "down" && (
                        <>
                          <TrendingDown className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 font-medium">Improving</span>
                        </>
                      )}
                      {company.trend === "stable" && (
                        <>
                          <Minus className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-500">Stable</span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => router.push(`/companies/${company.id}`)}
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      View
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Building2 className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
              <p className="text-gray-600">There are no active companies to display health data for.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
