"use client"

import { useAuth } from "@/lib/auth-context"
import DashboardLayout from "@/components/dashboard-layout"
import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, AlertTriangle, ChevronDown, ChevronRight, Clock, ArrowRight } from "lucide-react"

// --- Types ---

interface Integration {
  id: string
  status: string
  priority: string | null
  current_blockers: string | null
  go_live_planned_date: string | null
  created_at: string
  dev_start_date: string | null
  internal_testing_start_date: string | null
  insurer_uat_start_date: string | null
  company_name: string | null
  insurer_name: string | null
  product_name: string | null
  sub_product_name: string | null
  days_in_stage: number
}

interface StageInfo {
  count: number
  blocked_count: number
  high_priority_count: number
}

interface PipelineData {
  stages: Record<string, StageInfo>
  integrations: Integration[]
  totalActive: number
  totalLive: number
}

// --- Constants ---

const PIPELINE_STAGES = [
  "Not Started",
  "Development",
  "Internal Testing",
  "UAT in Progress",
  "Go Live",
] as const

type PipelineStage = (typeof PIPELINE_STAGES)[number]

const STAGE_COLORS: Record<PipelineStage, { bg: string; border: string; text: string; bar: string }> = {
  "Not Started": { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-700", bar: "bg-gray-400" },
  "Development": { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", bar: "bg-blue-500" },
  "Internal Testing": { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700", bar: "bg-yellow-500" },
  "UAT in Progress": { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", bar: "bg-purple-500" },
  "Go Live": { bg: "bg-green-50", border: "border-green-300", text: "text-green-700", bar: "bg-green-500" },
}

const PRIORITY_BADGE: Record<string, string> = {
  High: "bg-red-100 text-red-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Low: "bg-green-100 text-green-800",
}

// --- Component ---

export default function PipelinePage() {
  const { user } = useAuth()
  const router = useRouter()

  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const fetchPipelineData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/pipeline")
      if (!res.ok) {
        throw new Error("Failed to fetch pipeline data")
      }
      const json: PipelineData = await res.json()
      setData(json)

      // Auto-expand stages that have integrations
      const expanded: Record<string, boolean> = {}
      for (const stage of PIPELINE_STAGES) {
        const stageIntegrations = json.integrations.filter((i) => i.status === stage)
        if (stageIntegrations.length > 0) {
          expanded[stage] = true
        }
      }
      setExpandedStages(expanded)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchPipelineData()
    }
  }, [user, fetchPipelineData])

  const handleStageClick = (stage: string) => {
    setExpandedStages((prev) => ({ ...prev, [stage]: true }))
    const ref = sectionRefs.current[stage]
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const toggleStage = (stage: string) => {
    setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }))
  }

  const getStageIntegrations = (stage: string): Integration[] => {
    if (!data) return []
    return data.integrations.filter((i) => i.status === stage)
  }

  const getBlockedIntegrations = (): Integration[] => {
    if (!data) return []
    return data.integrations
      .filter((i) => i.current_blockers && i.current_blockers.trim() !== "")
      .sort((a, b) => b.days_in_stage - a.days_in_stage)
  }

  const getMaxCount = (): number => {
    if (!data) return 1
    let max = 1
    for (const stage of PIPELINE_STAGES) {
      const count = data.stages[stage]?.count || 0
      if (count > max) max = count
    }
    return max
  }

  // --- Skeleton Loading ---
  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex space-x-3">
              <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Funnel skeleton */}
          <div className="flex items-center space-x-3 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage} className="flex-shrink-0 w-48 h-32 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>

          {/* Stage sections skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      </DashboardLayout>
    )
  }

  // --- Error State ---
  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to load pipeline data</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchPipelineData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // --- Empty State ---
  if (!data || data.integrations.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <GitBranch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No integration projects yet</h3>
            <p className="text-gray-500">Integration projects will appear here as they are created and progress through the pipeline.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const maxCount = getMaxCount()
  const blockedIntegrations = getBlockedIntegrations()

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-blue-600" />
              Integration Pipeline
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Track integration projects across development stages
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm text-blue-600 font-medium">
                Active: <span className="font-bold">{data.totalActive}</span>
              </span>
            </div>
            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm text-green-600 font-medium">
                Live: <span className="font-bold">{data.totalLive}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2 flex-wrap md:flex-nowrap">
          {PIPELINE_STAGES.map((stage, idx) => {
            const stageData = data.stages[stage]
            const count = stageData?.count || 0
            const blockedCount = stageData?.blocked_count || 0
            const highPriorityCount = stageData?.high_priority_count || 0
            const colors = STAGE_COLORS[stage]
            const barWidth = maxCount > 0 ? Math.max((count / maxCount) * 100, 8) : 8

            return (
              <div key={stage} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => handleStageClick(stage)}
                  className={`w-44 p-4 rounded-xl border-2 ${colors.border} ${colors.bg} hover:shadow-md transition-all cursor-pointer text-left`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                    {stage}
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${colors.text}`}>{count}</p>
                  <div className="mt-2 h-2 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {blockedCount > 0 && (
                      <span className="text-orange-600 font-medium">{blockedCount} blocked</span>
                    )}
                    {highPriorityCount > 0 && (
                      <span className="text-red-600 font-medium">{highPriorityCount} high</span>
                    )}
                    {blockedCount === 0 && highPriorityCount === 0 && (
                      <span className="text-gray-400">No blockers</span>
                    )}
                  </div>
                </button>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-gray-300 mx-1 flex-shrink-0 hidden md:block" />
                )}
              </div>
            )
          })}
        </div>

        {/* Stage Detail Sections */}
        <div className="space-y-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageIntegrations = getStageIntegrations(stage)
            const stageData = data.stages[stage]
            const blockedCount = stageData?.blocked_count || 0
            const isExpanded = expandedStages[stage] || false
            const colors = STAGE_COLORS[stage]

            if (stageIntegrations.length === 0) return null

            return (
              <div
                key={stage}
                ref={(el) => { sectionRefs.current[stage] = el }}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleStage(stage)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                    <div className={`w-3 h-3 rounded-full ${colors.bar}`} />
                    <h3 className="text-base font-semibold text-gray-900">{stage}</h3>
                    <span className="text-sm text-gray-500">
                      ({stageIntegrations.length} integration{stageIntegrations.length !== 1 ? "s" : ""}{blockedCount > 0 ? `, ${blockedCount} with blockers` : ""})
                    </span>
                  </div>
                </button>

                {/* Section Body */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {stageIntegrations.map((integration) => (
                      <div
                        key={integration.id}
                        onClick={() => router.push("/integrations")}
                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div className="px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="font-medium text-gray-900 truncate">
                                {integration.company_name || "Unknown Company"}
                              </span>
                              <span className="text-gray-400">|</span>
                              <span className="text-gray-600 truncate">
                                {integration.insurer_name || "Unknown Insurer"}
                              </span>
                              <span className="text-gray-400">|</span>
                              <span className="text-gray-600 truncate">
                                {[integration.product_name, integration.sub_product_name]
                                  .filter(Boolean)
                                  .join(" / ") || "N/A"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{integration.days_in_stage} day{integration.days_in_stage !== 1 ? "s" : ""}</span>
                            </div>
                            {integration.priority && (
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                  PRIORITY_BADGE[integration.priority] || "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {integration.priority}
                              </span>
                            )}
                          </div>
                        </div>
                        {integration.current_blockers && integration.current_blockers.trim() !== "" && (
                          <div className="px-6 pb-3">
                            <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 rounded-lg px-3 py-2">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>Blocker: {integration.current_blockers}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Blockers Summary */}
        {blockedIntegrations.length > 0 && (
          <div className="bg-white border border-orange-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-orange-50 border-b border-orange-200">
              <h3 className="text-base font-semibold text-orange-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Active Blockers ({blockedIntegrations.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Insurer</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Days Stuck</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Blocker</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedIntegrations.map((integration) => (
                    <tr
                      key={integration.id}
                      onClick={() => router.push("/integrations")}
                      className="border-b border-gray-100 last:border-b-0 hover:bg-orange-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {integration.company_name || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {integration.insurer_name || "Unknown"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            STAGE_COLORS[integration.status as PipelineStage]?.bg || "bg-gray-100"
                          } ${STAGE_COLORS[integration.status as PipelineStage]?.text || "text-gray-700"}`}
                        >
                          {integration.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${integration.days_in_stage > 14 ? "text-red-600" : "text-gray-700"}`}>
                          {integration.days_in_stage} day{integration.days_in_stage !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-orange-700 max-w-xs truncate">
                        {integration.current_blockers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
