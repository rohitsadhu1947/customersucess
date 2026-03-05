"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Building2,
  Shield,
  Package,
  Layers,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Edit2,
  Trash2,
  Key,
  FileText,
  AlertCircle,
  Clock,
  Server,
  RefreshCw,
} from "lucide-react"

// ── Interfaces ──

interface IntegrationProject {
  id: string
  company_id: string
  company_name: string
  product_id: string
  product_name: string
  product_display_name: string
  product_code: string
  sub_product_id: string
  sub_product_name: string
  sub_product_display_name: string
  sub_product_code: string
  sub_product_category: string
  sub_product_sub_category: string
  insurer_id: string
  insurer_name: string
  insurer_short_name: string
  insurer_code: string
  status: string
  priority: string
  api_kit_received: boolean
  api_kit_received_date: string | null
  creds_verified: boolean
  creds_verification_date: string | null
  dev_required: boolean
  dev_start_date: string | null
  dev_end_date: string | null
  dev_estimated_hours: number | null
  internal_testing_start_date: string | null
  internal_testing_end_date: string | null
  insurer_uat_creds_received: boolean
  insurer_uat_start_date: string | null
  insurer_uat_end_date: string | null
  prod_creds_received: boolean
  prod_cred_receipt_date: string | null
  go_live_date: string | null
  go_live_planned_date: string | null
  current_blockers: string | null
  technical_notes: string | null
  business_notes: string | null
  created_by_name: string
  created_at: string
  updated_at: string
}

interface Credential {
  id: string
  integration_project_id: string
  environment: string
  credential_token: string | null
  credential_user_id: string | null
  credential_password: string | null
  additional_fields: Record<string, string>
  notes: string | null
  is_active: boolean
  created_by_name: string
  updated_by_name: string | null
  created_at: string
  updated_at: string
  // Masked fields (for Customer View Only)
  has_token?: boolean
  has_user_id?: boolean
  has_password?: boolean
  has_additional_fields?: boolean
  additional_field_keys?: string[]
}

// ── Constants ──

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-gray-100 text-gray-800",
  "API Kit Requested": "bg-blue-100 text-blue-800",
  "Credentials Pending": "bg-yellow-100 text-yellow-800",
  Development: "bg-indigo-100 text-indigo-800",
  "Internal Testing": "bg-purple-100 text-purple-800",
  "UAT in Progress": "bg-orange-100 text-orange-800",
  "Production Ready": "bg-teal-100 text-teal-800",
  "Go Live": "bg-green-100 text-green-800",
  "On Hold": "bg-red-100 text-red-800",
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-blue-100 text-blue-800",
  Low: "bg-gray-100 text-gray-800",
}

const WORKFLOW_STAGES = [
  { key: "api_kit_received", label: "API Kit Received", dateKey: "api_kit_received_date" },
  { key: "creds_verified", label: "Credentials Verified", dateKey: "creds_verification_date" },
  { key: "dev_required", label: "Development", dateKey: "dev_start_date", endDateKey: "dev_end_date" },
  { key: null, label: "Internal Testing", dateKey: "internal_testing_start_date", endDateKey: "internal_testing_end_date" },
  { key: "insurer_uat_creds_received", label: "UAT Credentials", dateKey: "insurer_uat_start_date" },
  { key: null, label: "UAT", dateKey: "insurer_uat_start_date", endDateKey: "insurer_uat_end_date" },
  { key: "prod_creds_received", label: "Production Credentials", dateKey: "prod_cred_receipt_date" },
  { key: null, label: "Go Live", dateKey: "go_live_date" },
]

export default function IntegrationDetailPage() {
  const { user, hasPermission } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [project, setProject] = useState<IntegrationProject | null>(null)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "notes">("overview")

  // Credential form state
  const [showCredForm, setShowCredForm] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [credFormEnv, setCredFormEnv] = useState<"UAT" | "Production">("UAT")
  const [credForm, setCredForm] = useState({
    credential_token: "",
    credential_user_id: "",
    credential_password: "",
    notes: "",
    additional_fields: {} as Record<string, string>,
  })
  const [newFieldKey, setNewFieldKey] = useState("")
  const [newFieldValue, setNewFieldValue] = useState("")
  const [saving, setSaving] = useState(false)

  // Visibility toggles
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const isReadOnly = user?.role === "Customer View Only"
  const canEdit = ["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user?.role || "")
  const canDelete = user?.role === "Admin"

  // ── Data Fetching ──

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/integration-projects/${id}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data)
      }
    } catch (error) {
      console.error("Error fetching project:", error)
    }
  }, [id])

  const fetchCredentials = useCallback(async () => {
    try {
      const res = await fetch(`/api/integration-projects/${id}/credentials`)
      if (res.ok) {
        const data = await res.json()
        setCredentials(data)
      }
    } catch (error) {
      console.error("Error fetching credentials:", error)
    }
  }, [id])

  useEffect(() => {
    if (user && hasPermission("integrations") && id) {
      Promise.all([fetchProject(), fetchCredentials()]).finally(() => setLoading(false))
    }
  }, [user, hasPermission, id, fetchProject, fetchCredentials])

  // ── Helpers ──

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  }

  const maskValue = (value: string | null) => {
    if (!value) return ""
    if (value.length <= 4) return "••••"
    return "••••••••" + value.slice(-4)
  }

  const toggleVisibility = (fieldId: string) => {
    setVisibleFields((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }))
  }

  const copyToClipboard = async (value: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Fallback
    }
  }

  const getProgressPercent = (p: IntegrationProject) => {
    const stages = [
      p.api_kit_received,
      p.creds_verified,
      p.dev_start_date !== null,
      p.internal_testing_start_date !== null,
      p.insurer_uat_creds_received,
      p.insurer_uat_start_date !== null,
      p.prod_creds_received,
      p.go_live_date !== null,
    ]
    const done = stages.filter(Boolean).length
    return Math.round((done / stages.length) * 100)
  }

  // ── Credential CRUD ──

  const openCredForm = (env: "UAT" | "Production", cred?: Credential) => {
    setCredFormEnv(env)
    if (cred) {
      setEditingCredential(cred)
      setCredForm({
        credential_token: cred.credential_token || "",
        credential_user_id: cred.credential_user_id || "",
        credential_password: cred.credential_password || "",
        notes: cred.notes || "",
        additional_fields: cred.additional_fields || {},
      })
    } else {
      setEditingCredential(null)
      setCredForm({ credential_token: "", credential_user_id: "", credential_password: "", notes: "", additional_fields: {} })
    }
    setNewFieldKey("")
    setNewFieldValue("")
    setShowCredForm(true)
  }

  const closeCredForm = () => {
    setShowCredForm(false)
    setEditingCredential(null)
    setCredForm({ credential_token: "", credential_user_id: "", credential_password: "", notes: "", additional_fields: {} })
  }

  const addAdditionalField = () => {
    if (!newFieldKey.trim()) return
    setCredForm((prev) => ({
      ...prev,
      additional_fields: { ...prev.additional_fields, [newFieldKey.trim()]: newFieldValue },
    }))
    setNewFieldKey("")
    setNewFieldValue("")
  }

  const removeAdditionalField = (key: string) => {
    setCredForm((prev) => {
      const updated = { ...prev.additional_fields }
      delete updated[key]
      return { ...prev, additional_fields: updated }
    })
  }

  const handleSaveCredential = async () => {
    setSaving(true)
    try {
      const payload = {
        ...credForm,
        environment: credFormEnv,
        ...(editingCredential ? { id: editingCredential.id } : {}),
      }

      const res = await fetch(`/api/integration-projects/${id}/credentials`, {
        method: editingCredential ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Failed to save credentials")
        return
      }

      await fetchCredentials()
      await fetchProject() // Refresh to get updated boolean flags
      closeCredForm()
    } catch (error) {
      console.error("Error saving credential:", error)
      alert("Failed to save credentials")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCredential = async (credentialId: string) => {
    if (!confirm("Are you sure you want to delete this credential set?")) return
    try {
      const res = await fetch(`/api/integration-projects/${id}/credentials?credentialId=${credentialId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        await fetchCredentials()
      } else {
        const err = await res.json()
        alert(err.error || "Failed to delete credentials")
      }
    } catch {
      alert("Failed to delete credentials")
    }
  }

  // ── Render Guards ──

  if (!hasPermission("integrations")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to view integrations.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-96 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-96 animate-pulse" />
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-96 animate-pulse" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Integration project not found.</p>
          <button onClick={() => router.push("/integrations")} className="mt-4 text-blue-600 hover:underline">
            Back to Integrations
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const uatCred = credentials.find((c) => c.environment === "UAT")
  const prodCred = credentials.find((c) => c.environment === "Production")
  const progress = getProgressPercent(project)

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Back Button + Header */}
          <button
            onClick={() => router.push("/integrations")}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Integrations
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {project.sub_product_display_name || project.sub_product_name}
              </h1>
              <p className="text-gray-500 mt-1">
                {project.company_name} × {project.insurer_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={STATUS_COLORS[project.status] || "bg-gray-100 text-gray-800"}>
                {project.status}
              </Badge>
              <Badge className={PRIORITY_COLORS[project.priority] || "bg-gray-100 text-gray-800"}>
                {project.priority}
              </Badge>
            </div>
          </div>

          {/* Tabs + Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tab Buttons */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  {[
                    { id: "overview" as const, label: "Overview", icon: Layers },
                    { id: "credentials" as const, label: "Credentials", icon: Key },
                    { id: "notes" as const, label: "Notes", icon: FileText },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <tab.icon className="h-4 w-4 mr-2" />
                      {tab.label}
                      {tab.id === "credentials" && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                          {credentials.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab: Overview */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Progress Bar */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase">Project Progress</h3>
                      <span className="text-sm font-bold text-blue-600">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Workflow Timeline */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Workflow Timeline</h3>
                    <div className="space-y-4">
                      {WORKFLOW_STAGES.map((stage, idx) => {
                        const isComplete =
                          stage.key !== null
                            ? !!(project as any)[stage.key]
                            : !!(project as any)[stage.dateKey]
                        const dateVal = (project as any)[stage.dateKey]
                        const endDateVal = stage.endDateKey ? (project as any)[stage.endDateKey] : null

                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 ${isComplete ? "text-green-500" : "text-gray-300"}`}>
                              {isComplete ? (
                                <CheckCircle className="h-5 w-5" />
                              ) : (
                                <XCircle className="h-5 w-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${isComplete ? "text-gray-900" : "text-gray-400"}`}>
                                {stage.label}
                              </p>
                              {dateVal && (
                                <p className="text-xs text-gray-500">
                                  {formatDate(dateVal)}
                                  {endDateVal ? ` — ${formatDate(endDateVal)}` : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Credentials */}
              {activeTab === "credentials" && (
                <div className="space-y-6">
                  {/* Credential Form Modal */}
                  {showCredForm && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {editingCredential ? "Edit" : "Add"} {credFormEnv} Credentials
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {project.insurer_name} — {project.sub_product_display_name || project.sub_product_name}
                          </p>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                            <input
                              type="text"
                              value={credForm.credential_token}
                              onChange={(e) => setCredForm({ ...credForm, credential_token: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="API token or key"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                            <input
                              type="text"
                              value={credForm.credential_user_id}
                              onChange={(e) => setCredForm({ ...credForm, credential_user_id: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="API user ID or username"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                              type="text"
                              value={credForm.credential_password}
                              onChange={(e) => setCredForm({ ...credForm, credential_password: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="API password or secret"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                              value={credForm.notes}
                              onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Any additional notes about these credentials"
                            />
                          </div>

                          {/* Additional Fields */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Additional Fields</label>
                            {Object.entries(credForm.additional_fields).map(([key, val]) => (
                              <div key={key} className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-600 w-32 truncate">{key}</span>
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) =>
                                    setCredForm((prev) => ({
                                      ...prev,
                                      additional_fields: { ...prev.additional_fields, [key]: e.target.value },
                                    }))
                                  }
                                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                />
                                <button
                                  onClick={() => removeAdditionalField(key)}
                                  className="p-1 text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Field name"
                                value={newFieldKey}
                                onChange={(e) => setNewFieldKey(e.target.value)}
                                className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                              />
                              <input
                                type="text"
                                placeholder="Value"
                                value={newFieldValue}
                                onChange={(e) => setNewFieldValue(e.target.value)}
                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                              />
                              <Button variant="outline" size="sm" onClick={addAdditionalField} disabled={!newFieldKey.trim()}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                          <Button variant="outline" onClick={closeCredForm} disabled={saving}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveCredential} disabled={saving}>
                            {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            {editingCredential ? "Update" : "Save"} Credentials
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UAT & Production Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* UAT Card */}
                    <CredentialCard
                      label="UAT"
                      credential={uatCred}
                      isReadOnly={isReadOnly}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      visibleFields={visibleFields}
                      copiedField={copiedField}
                      onToggleVisibility={toggleVisibility}
                      onCopy={copyToClipboard}
                      onAdd={() => openCredForm("UAT")}
                      onEdit={(c) => openCredForm("UAT", c)}
                      onDelete={handleDeleteCredential}
                      formatDate={formatDate}
                      maskValue={maskValue}
                    />

                    {/* Production Card */}
                    <CredentialCard
                      label="Production"
                      credential={prodCred}
                      isReadOnly={isReadOnly}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      visibleFields={visibleFields}
                      copiedField={copiedField}
                      onToggleVisibility={toggleVisibility}
                      onCopy={copyToClipboard}
                      onAdd={() => openCredForm("Production")}
                      onEdit={(c) => openCredForm("Production", c)}
                      onDelete={handleDeleteCredential}
                      formatDate={formatDate}
                      maskValue={maskValue}
                    />
                  </div>
                </div>
              )}

              {/* Tab: Notes */}
              {activeTab === "notes" && (
                <div className="space-y-6">
                  {project.current_blockers && (
                    <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                      <h3 className="text-sm font-semibold text-red-800 uppercase mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Current Blockers
                      </h3>
                      <p className="text-sm text-red-700 whitespace-pre-wrap">{project.current_blockers}</p>
                    </div>
                  )}
                  {project.technical_notes && (
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                      <h3 className="text-sm font-semibold text-blue-800 uppercase mb-2 flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Technical Notes
                      </h3>
                      <p className="text-sm text-blue-700 whitespace-pre-wrap">{project.technical_notes}</p>
                    </div>
                  )}
                  {project.business_notes && (
                    <div className="bg-green-50 rounded-xl border border-green-200 p-6">
                      <h3 className="text-sm font-semibold text-green-800 uppercase mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Business Notes
                      </h3>
                      <p className="text-sm text-green-700 whitespace-pre-wrap">{project.business_notes}</p>
                    </div>
                  )}
                  {!project.current_blockers && !project.technical_notes && !project.business_notes && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                      <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No notes added yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Project Details */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Project Details</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Company</p>
                      <p className="text-sm font-medium text-gray-900">{project.company_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Package className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Product</p>
                      <p className="text-sm font-medium text-gray-900">
                        {project.product_display_name || project.product_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {project.sub_product_display_name || project.sub_product_name}
                        {project.sub_product_category ? ` (${project.sub_product_category})` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Insurer</p>
                      <p className="text-sm font-medium text-gray-900">{project.insurer_name}</p>
                      {project.insurer_short_name && (
                        <p className="text-xs text-gray-500">{project.insurer_short_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Progress</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{progress}%</span>
                      </div>
                    </div>
                  </div>
                  {project.dev_estimated_hours && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Estimated Hours</p>
                        <p className="text-sm font-medium text-gray-900">{project.dev_estimated_hours}h</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Key Dates */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Key Dates</h3>
                <div className="space-y-3">
                  {[
                    { label: "API Kit Received", value: project.api_kit_received_date },
                    { label: "Dev Start", value: project.dev_start_date },
                    { label: "Dev End", value: project.dev_end_date },
                    { label: "UAT Start", value: project.insurer_uat_start_date },
                    { label: "UAT End", value: project.insurer_uat_end_date },
                    { label: "Planned Go-Live", value: project.go_live_planned_date },
                    { label: "Actual Go-Live", value: project.go_live_date },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{item.label}</span>
                      <span className={`text-sm ${item.value ? "font-medium text-gray-900" : "text-gray-300"}`}>
                        {formatDate(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Created / Updated */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Created by</span>
                    <span className="text-sm text-gray-700">{project.created_by_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Created</span>
                    <span className="text-sm text-gray-700">{formatDate(project.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Updated</span>
                    <span className="text-sm text-gray-700">{formatDate(project.updated_at)}</span>
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

// ── Credential Card Component ──

function CredentialCard({
  label,
  credential,
  isReadOnly,
  canEdit,
  canDelete,
  visibleFields,
  copiedField,
  onToggleVisibility,
  onCopy,
  onAdd,
  onEdit,
  onDelete,
  formatDate,
  maskValue,
}: {
  label: string
  credential: Credential | undefined
  isReadOnly: boolean
  canEdit: boolean
  canDelete: boolean
  visibleFields: Record<string, boolean>
  copiedField: string | null
  onToggleVisibility: (id: string) => void
  onCopy: (value: string, id: string) => void
  onAdd: () => void
  onEdit: (c: Credential) => void
  onDelete: (id: string) => void
  formatDate: (d: string | null) => string
  maskValue: (v: string | null) => string
}) {
  const envColor = label === "UAT" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
  const envBadge = label === "UAT" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"

  if (!credential) {
    return (
      <div className={`rounded-xl border-2 border-dashed ${label === "UAT" ? "border-amber-200" : "border-green-200"} p-6`}>
        <div className="text-center">
          <Badge className={envBadge}>{label}</Badge>
          <Key className="h-8 w-8 text-gray-300 mx-auto mt-4 mb-2" />
          <p className="text-sm text-gray-500 mb-4">No credentials added</p>
          {canEdit && !isReadOnly && (
            <Button variant="outline" size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add {label} Credentials
            </Button>
          )}
        </div>
      </div>
    )
  }

  const fields = [
    { key: "token", label: "Token", value: credential.credential_token, hasValue: credential.has_token },
    { key: "user_id", label: "User ID", value: credential.credential_user_id, hasValue: credential.has_user_id },
    { key: "password", label: "Password", value: credential.credential_password, hasValue: credential.has_password },
  ]

  // Additional fields
  const additionalEntries = isReadOnly
    ? (credential.additional_field_keys || []).map((k) => ({ key: k, label: k, value: null, hasValue: true }))
    : Object.entries(credential.additional_fields || {}).map(([k, v]) => ({ key: k, label: k, value: v, hasValue: true }))

  return (
    <div className={`rounded-xl border ${envColor} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge className={envBadge}>{label}</Badge>
          {credential.is_active && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !isReadOnly && (
            <button
              onClick={() => onEdit(credential)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50"
              title="Edit credentials"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(credential.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white/50"
              title="Delete credentials"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((field) => {
          const fieldId = `${credential.id}-${field.key}`
          const isVisible = visibleFields[fieldId]
          const isCopied = copiedField === fieldId
          const hasVal = isReadOnly ? field.hasValue : !!field.value

          if (!hasVal) return null

          return (
            <div key={field.key}>
              <p className="text-xs text-gray-500 mb-1">{field.label}</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-sm font-mono bg-white/70 px-2 py-1 rounded border border-gray-200 truncate">
                  {isReadOnly ? "••••••••" : isVisible ? field.value : maskValue(field.value)}
                </code>
                {!isReadOnly && (
                  <>
                    <button
                      onClick={() => onToggleVisibility(fieldId)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title={isVisible ? "Hide" : "Show"}
                    >
                      {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => field.value && onCopy(field.value, fieldId)}
                      className={`p-1 ${isCopied ? "text-green-500" : "text-gray-400 hover:text-gray-600"}`}
                      title={isCopied ? "Copied!" : "Copy"}
                    >
                      {isCopied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {/* Additional Fields */}
        {additionalEntries.length > 0 && (
          <div className="pt-2 border-t border-gray-200/50">
            <p className="text-xs text-gray-500 mb-2 font-medium">Additional Fields</p>
            {additionalEntries.map((field) => {
              const fieldId = `${credential.id}-extra-${field.key}`
              const isVisible = visibleFields[fieldId]
              const isCopied = copiedField === fieldId

              return (
                <div key={field.key} className="mb-2">
                  <p className="text-xs text-gray-500 mb-0.5">{field.label}</p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 text-sm font-mono bg-white/70 px-2 py-1 rounded border border-gray-200 truncate">
                      {isReadOnly ? "••••••••" : isVisible ? field.value : maskValue(field.value)}
                    </code>
                    {!isReadOnly && field.value && (
                      <>
                        <button
                          onClick={() => onToggleVisibility(fieldId)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => onCopy(field.value!, fieldId)}
                          className={`p-1 ${isCopied ? "text-green-500" : "text-gray-400 hover:text-gray-600"}`}
                        >
                          {isCopied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer metadata */}
      {credential.notes && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200/50 italic">{credential.notes}</p>
      )}
      <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-200/50 space-y-0.5">
        <p>Added by {credential.created_by_name} on {formatDate(credential.created_at)}</p>
        {credential.updated_by_name && (
          <p>Last updated by {credential.updated_by_name} on {formatDate(credential.updated_at)}</p>
        )}
      </div>
    </div>
  )
}
