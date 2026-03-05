"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getSlaStatus, formatSlaTimeRemaining } from "@/lib/sla"
import {
  ArrowLeft,
  Send,
  Lock,
  Clock,
  Building2,
  User,
  Calendar,
  Copy,
  Tag,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  History,
  Paperclip,
  X,
  FileText,
  Download,
} from "lucide-react"
import { ATTACHMENT_MAX_FILE_SIZE, ATTACHMENT_ALLOWED_EXTENSIONS, formatFileSize } from "@/lib/validations"

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  sub_category: string
  status: string
  priority: string
  source: string
  company_id: string
  company_name: string
  created_by_id: string
  created_by_name: string
  assigned_to_id: string | null
  assigned_to_name: string | null
  assigned_group: string | null
  related_integration_id: string | null
  tags: string | string[]
  due_date: string | null
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  sla_breach: boolean
  sla_response_breach: boolean
  created_at: string
  updated_at: string
}

interface TicketResponse {
  id: string
  ticket_id: string
  response_type: "reply" | "internal_note" | "system"
  body: string
  created_by_id: string
  created_by_name: string
  created_by_role: string
  created_at: string
}

interface HistoryEntry {
  id: string
  ticket_id: string
  user_id: string
  user_name: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}

interface EnsureditUser {
  id: string
  name: string
  role_type: string
  is_active: boolean
}

interface Attachment {
  id: string
  ticket_id: string
  response_id: string | null
  file_name: string
  file_type: string
  file_size: number
  uploaded_by_id: string
  uploaded_by_name: string
  created_at: string
}

const TICKET_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting on Customer",
  "Waiting on Internal",
  "Escalated",
  "Resolved",
  "Closed",
]

const TICKET_PRIORITIES = ["Critical", "High", "Medium", "Low"]

export default function TicketDetailPage() {
  const { user, hasPermission } = useAuth()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const conversationEndRef = useRef<HTMLDivElement>(null)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [responses, setResponses] = useState<TicketResponse[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"conversation" | "activity">("conversation")
  const [replyBody, setReplyBody] = useState("")
  const [replyType, setReplyType] = useState<"reply" | "internal_note">("reply")
  const [submitting, setSubmitting] = useState(false)
  const [ensureditUsers, setEnsureditUsers] = useState<EnsureditUser[]>([])
  const [updating, setUpdating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [replyFiles, setReplyFiles] = useState<File[]>([])

  const isEnsuredit = ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "")
  const isCustomerViewOnly = user?.role === "Customer View Only"

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`)
      if (res.ok) {
        setTicket(await res.json())
      }
    } catch (error) {
      console.error("Error fetching ticket:", error)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchResponses = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}/responses`)
      if (res.ok) {
        setResponses(await res.json())
      }
    } catch {
      // responses table may not exist yet
    }
  }, [id])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}/history`)
      if (res.ok) {
        setHistory(await res.json())
      }
    } catch {
      // history table may not exist yet
    }
  }, [id])

  const fetchEnsureditUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        const users = Array.isArray(data) ? data : data.data || []
        const filtered = users.filter((u: EnsureditUser) =>
          u.is_active !== false && ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(u.role_type)
        )
        setEnsureditUsers(filtered)
      }
    } catch {
      // users endpoint may not be available
    }
  }, [])

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}/attachments`)
      if (res.ok) setAttachments(await res.json())
    } catch (error) {
      console.error("Error fetching attachments:", error)
    }
  }, [id])

  useEffect(() => {
    if (user && id) {
      fetchTicket()
      fetchResponses()
      fetchHistory()
      fetchAttachments()
      if (isEnsuredit) {
        fetchEnsureditUsers()
      }
    }
  }, [user, id, fetchTicket, fetchResponses, fetchHistory, fetchAttachments, isEnsuredit, fetchEnsureditUsers])

  useEffect(() => {
    if (conversationEndRef.current && activeTab === "conversation") {
      conversationEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [responses, activeTab])

  const handleSendReply = async () => {
    if (!replyBody.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tickets/${id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody, response_type: replyType }),
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText)
      }
      const newResponse = await res.json()

      // Upload attachments linked to this response
      if (replyFiles.length > 0) {
        const uploadData = new FormData()
        uploadData.append("response_id", newResponse.id)
        replyFiles.forEach(file => uploadData.append("files", file))
        const uploadRes = await fetch(`/api/tickets/${id}/attachments`, {
          method: "POST",
          body: uploadData,
        })
        if (!uploadRes.ok) {
          console.error("Attachment upload failed:", await uploadRes.text())
          alert("Reply sent, but some attachments failed to upload.")
        }
      }

      setReplyBody("")
      setReplyType("reply")
      setReplyFiles([])
      fetchResponses()
      fetchTicket()
      fetchAttachments()
    } catch (error) {
      console.error("Error sending reply:", error)
      alert(`Failed to send reply: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateTicket = async (updates: Record<string, unknown>) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText)
      }
      const updated = await res.json()
      setTicket(updated)
      fetchResponses()
      fetchHistory()
    } catch (error) {
      console.error("Error updating ticket:", error)
      alert(`Failed to update ticket: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleCopyTicketNumber = () => {
    if (ticket) {
      navigator.clipboard.writeText(ticket.ticket_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      New: "bg-gray-100 text-gray-800",
      Open: "bg-blue-100 text-blue-800",
      "In Progress": "bg-indigo-100 text-indigo-800",
      "Waiting on Customer": "bg-amber-100 text-amber-800",
      "Waiting on Internal": "bg-purple-100 text-purple-800",
      Escalated: "bg-red-100 text-red-800",
      Resolved: "bg-green-100 text-green-800",
      Closed: "bg-gray-100 text-gray-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      Critical: "bg-red-100 text-red-800",
      High: "bg-orange-100 text-orange-800",
      Medium: "bg-blue-100 text-blue-800",
      Low: "bg-gray-100 text-gray-800",
    }
    return colors[priority] || "bg-gray-100 text-gray-800"
  }

  const getSlaIndicator = () => {
    if (!ticket) return null
    const slaStatus = getSlaStatus(
      ticket.priority,
      ticket.created_at,
      ticket.first_response_at,
      ticket.resolved_at,
      ticket.due_date
    )
    const timeRemaining = formatSlaTimeRemaining(ticket.due_date, ticket.resolved_at)

    const dotColor =
      slaStatus === "ok"
        ? "bg-green-500"
        : slaStatus === "warning"
        ? "bg-yellow-500"
        : "bg-red-500"
    const textColor =
      slaStatus === "ok"
        ? "text-green-700"
        : slaStatus === "warning"
        ? "text-yellow-700"
        : "text-red-700"

    return (
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
        <span className={`text-sm font-medium ${textColor}`}>
          {slaStatus === "ok" && "Within SLA"}
          {slaStatus === "warning" && "SLA Warning"}
          {slaStatus === "breached" && "SLA Breached"}
        </span>
        {timeRemaining && (
          <span className={`text-xs ${textColor}`}>({timeRemaining})</span>
        )}
      </div>
    )
  }

  const getDueDateColor = () => {
    if (!ticket) return "text-gray-900"
    const slaStatus = getSlaStatus(
      ticket.priority,
      ticket.created_at,
      ticket.first_response_at,
      ticket.resolved_at,
      ticket.due_date
    )
    if (slaStatus === "breached") return "text-red-600 font-semibold"
    if (slaStatus === "warning") return "text-yellow-600 font-semibold"
    return "text-gray-900"
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const isEnsureditRole = (role: string) => {
    return ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(role)
  }

  const parseTags = (tags: string | string[] | null | undefined): string[] => {
    if (!tags) return []
    if (Array.isArray(tags)) return tags
    try {
      const parsed = JSON.parse(tags)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleString()
  }

  const getAttachmentsForResponse = (responseId: string) =>
    attachments.filter(a => a.response_id === responseId)

  const ticketAttachments = attachments.filter(a => a.response_id === null)

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    const validFiles: File[] = []
    for (const file of newFiles) {
      if (file.size > ATTACHMENT_MAX_FILE_SIZE) {
        alert(`File "${file.name}" exceeds 5MB limit`)
        continue
      }
      const ext = "." + file.name.split(".").pop()?.toLowerCase()
      if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) {
        alert(`File type not allowed: ${file.name}`)
        continue
      }
      validFiles.push(file)
    }
    const combined = [...replyFiles, ...validFiles]
    if (combined.length > 5) {
      alert("Maximum 5 files allowed")
      return
    }
    setReplyFiles(combined)
    e.target.value = ""
  }

  if (!hasPermission("tickets")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to view tickets.</p>
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

  if (!ticket) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h1>
            <Button onClick={() => router.push("/tickets")} variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tickets
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const ticketTags = parseTags(ticket.tags)

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button onClick={() => router.push("/tickets")} variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tickets
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
                </div>
                <p className="text-gray-500 mt-1">Ticket {ticket.ticket_number}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
              </div>
            </div>

            {/* Action buttons row (Ensuredit only) */}
            {isEnsuredit && (
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Status:</label>
                  <select
                    value={ticket.status}
                    onChange={(e) => handleUpdateTicket({ status: e.target.value })}
                    disabled={updating}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Assign:</label>
                  <select
                    value={ticket.assigned_to_id || ""}
                    onChange={(e) => {
                      const selectedUser = ensureditUsers.find((u) => u.id === e.target.value)
                      handleUpdateTicket({
                        assigned_to_id: e.target.value || null,
                        assigned_to_name: selectedUser?.name || null,
                      })
                    }}
                    disabled={updating}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {ensureditUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Priority:</label>
                  <select
                    value={ticket.priority}
                    onChange={(e) => handleUpdateTicket({ priority: e.target.value })}
                    disabled={updating}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {ticket.description || "No description provided."}
                </p>
                {ticketAttachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {ticketAttachments.map(att => {
                        const isImage = att.file_type.startsWith("image/")
                        return (
                          <a
                            key={att.id}
                            href={`/api/tickets/${id}/attachments/${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                          >
                            {isImage ? <FileText className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-gray-500" />}
                            <span className="truncate max-w-[150px]">{att.file_name}</span>
                            <span className="text-xs text-gray-400">({formatFileSize(att.file_size)})</span>
                            <Download className="h-3.5 w-3.5 text-gray-400" />
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs: Conversation / Activity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab("conversation")}
                      className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "conversation"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Conversation ({responses.filter((r) => r.response_type !== "system").length})
                    </button>
                    <button
                      onClick={() => setActiveTab("activity")}
                      className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "activity"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <History className="h-4 w-4 mr-2" />
                      Activity ({history.length})
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === "conversation" ? (
                    <div className="space-y-4">
                      {responses.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                          No messages yet. Start the conversation.
                        </p>
                      ) : (
                        responses.map((r) => {
                          if (r.response_type === "system") {
                            return (
                              <div key={r.id} className="text-center py-2">
                                <p className="text-xs text-gray-500">{r.body}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {formatDate(r.created_at)}
                                </p>
                              </div>
                            )
                          }

                          if (r.response_type === "internal_note") {
                            return (
                              <div
                                key={r.id}
                                className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-yellow-600 w-7 h-7 rounded-full flex items-center justify-center">
                                      <span className="text-white text-xs font-medium">
                                        {getInitials(r.created_by_name)}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">
                                      {r.created_by_name}
                                    </span>
                                    <span className="flex items-center text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                                      <Lock className="h-3 w-3 mr-1" />
                                      Internal Note
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {formatDate(r.created_at)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {r.body}
                                </p>
                                {getAttachmentsForResponse(r.id).length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {getAttachmentsForResponse(r.id).map(att => {
                                      const isImage = att.file_type.startsWith("image/")
                                      return (
                                        <a
                                          key={att.id}
                                          href={`/api/tickets/${id}/attachments/${att.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors text-xs"
                                        >
                                          {isImage ? <FileText className="h-3.5 w-3.5 text-blue-500" /> : <FileText className="h-3.5 w-3.5 text-gray-500" />}
                                          <span className="truncate max-w-[120px]">{att.file_name}</span>
                                          <span className="text-gray-400">({formatFileSize(att.file_size)})</span>
                                          <Download className="h-3 w-3 text-gray-400" />
                                        </a>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          // reply type
                          const isEnsureditReply = isEnsureditRole(r.created_by_role)
                          const borderColor = isEnsureditReply
                            ? "border-l-4 border-green-400"
                            : "border-l-4 border-blue-400"
                          const avatarBg = isEnsureditReply ? "bg-green-600" : "bg-blue-600"

                          return (
                            <div
                              key={r.id}
                              className={`bg-white border border-gray-200 rounded-lg p-4 ${borderColor}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`${avatarBg} w-7 h-7 rounded-full flex items-center justify-center`}
                                  >
                                    <span className="text-white text-xs font-medium">
                                      {getInitials(r.created_by_name)}
                                    </span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {r.created_by_name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      isEnsureditReply
                                        ? "border-green-300 text-green-700"
                                        : "border-blue-300 text-blue-700"
                                    }`}
                                  >
                                    {r.created_by_role}
                                  </Badge>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatDate(r.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
                              {getAttachmentsForResponse(r.id).length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {getAttachmentsForResponse(r.id).map(att => {
                                    const isImage = att.file_type.startsWith("image/")
                                    return (
                                      <a
                                        key={att.id}
                                        href={`/api/tickets/${id}/attachments/${att.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors text-xs"
                                      >
                                        {isImage ? <FileText className="h-3.5 w-3.5 text-blue-500" /> : <FileText className="h-3.5 w-3.5 text-gray-500" />}
                                        <span className="truncate max-w-[120px]">{att.file_name}</span>
                                        <span className="text-gray-400">({formatFileSize(att.file_size)})</span>
                                        <Download className="h-3 w-3 text-gray-400" />
                                      </a>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                      <div ref={conversationEndRef} />

                      {/* Reply Box */}
                      {!isCustomerViewOnly && (
                        <div className="pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
                          <Textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder={
                              replyType === "internal_note"
                                ? "Write an internal note..."
                                : "Write a reply..."
                            }
                            rows={3}
                            className={
                              replyType === "internal_note"
                                ? "border-yellow-300 focus:ring-yellow-500 bg-yellow-50"
                                : ""
                            }
                          />
                          {/* File attachments */}
                          <div className="flex items-center gap-3 mt-2">
                            <input
                              type="file"
                              multiple
                              onChange={handleReplyFileSelect}
                              className="hidden"
                              id="reply-files"
                              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                            />
                            <label htmlFor="reply-files" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
                              <Paperclip className="h-4 w-4" />
                              Attach files
                            </label>
                            {replyFiles.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {replyFiles.map((file, idx) => (
                                  <span key={idx} className="inline-flex items-center text-xs bg-blue-50 text-blue-700 rounded px-2 py-1">
                                    {file.name} ({formatFileSize(file.size)})
                                    <button onClick={() => setReplyFiles(prev => prev.filter((_, i) => i !== idx))} className="ml-1 hover:text-red-500">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div>
                              {isEnsuredit && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setReplyType("reply")}
                                    className={`flex items-center text-sm px-3 py-1.5 rounded-lg transition-colors ${
                                      replyType === "reply"
                                        ? "bg-blue-100 text-blue-700 font-medium"
                                        : "text-gray-500 hover:bg-gray-100"
                                    }`}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                    Reply
                                  </button>
                                  <button
                                    onClick={() => setReplyType("internal_note")}
                                    className={`flex items-center text-sm px-3 py-1.5 rounded-lg transition-colors ${
                                      replyType === "internal_note"
                                        ? "bg-yellow-100 text-yellow-700 font-medium"
                                        : "text-gray-500 hover:bg-gray-100"
                                    }`}
                                  >
                                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                                    Internal Note
                                  </button>
                                </div>
                              )}
                            </div>
                            <Button
                              onClick={handleSendReply}
                              disabled={!replyBody.trim() || submitting}
                              size="sm"
                              className={
                                replyType === "internal_note"
                                  ? "bg-yellow-600 hover:bg-yellow-700"
                                  : ""
                              }
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {submitting
                                ? "Sending..."
                                : replyType === "internal_note"
                                ? "Add Note"
                                : "Send Reply"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Activity Tab */
                    <div className="space-y-3">
                      {history.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                          No activity recorded yet.
                        </p>
                      ) : (
                        history.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="bg-gray-200 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-gray-600 text-xs font-medium">
                                {getInitials(h.user_name)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">
                                <span className="font-medium text-gray-900">{h.user_name}</span>{" "}
                                {h.action === "create" && "created this ticket"}
                                {h.action === "update" && h.field_name && (
                                  <>
                                    changed{" "}
                                    <span className="font-medium">{h.field_name}</span>
                                    {h.old_value && (
                                      <>
                                        {" "}
                                        from{" "}
                                        <span className="text-red-600 line-through">
                                          {h.old_value}
                                        </span>
                                      </>
                                    )}
                                    {h.new_value && (
                                      <>
                                        {" "}
                                        to{" "}
                                        <span className="text-green-600">{h.new_value}</span>
                                      </>
                                    )}
                                  </>
                                )}
                                {h.action === "update" && !h.field_name && "updated this ticket"}
                                {h.action === "delete" && "deleted this ticket"}
                              </div>
                              <span className="text-xs text-gray-500">
                                {formatDate(h.created_at)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar (1/3) */}
            <div className="space-y-6">
              {/* Status & Priority & SLA */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Status &amp; Priority</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Priority</p>
                    <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">SLA</p>
                    {getSlaIndicator()}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Details</h3>

                <div>
                  <p className="text-xs text-gray-500">Company</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {ticket.company_name}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {ticket.category}
                    {ticket.sub_category && ` / ${ticket.sub_category}`}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Source</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {ticket.source || "web"}
                  </Badge>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Ticket #</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {ticket.ticket_number}
                    </span>
                    <button
                      onClick={handleCopyTicketNumber}
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Copy ticket number"
                    >
                      {copied ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {ticketTags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {ticketTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* People */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">People</h3>

                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-medium">
                      {getInitials(ticket.created_by_name)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created by</p>
                    <p className="text-sm text-gray-900">{ticket.created_by_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ticket.assigned_to_name ? (
                    <>
                      <div className="bg-green-600 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-medium">
                          {getInitials(ticket.assigned_to_name)}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Assigned to</p>
                        <p className="text-sm text-gray-900">{ticket.assigned_to_name}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-200 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-3.5 w-3.5 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Assigned to</p>
                        <p className="text-sm text-gray-500 italic">Unassigned</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Dates</h3>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm text-gray-900">{formatDate(ticket.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">First Response</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(ticket.first_response_at) || (
                        <span className="text-gray-400 italic">Awaiting response</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Due Date</p>
                    <p className={`text-sm ${getDueDateColor()}`}>
                      {formatDate(ticket.due_date) || (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </p>
                  </div>
                </div>

                {ticket.resolved_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-gray-500">Resolved</p>
                      <p className="text-sm text-gray-900">{formatDate(ticket.resolved_at)}</p>
                    </div>
                  </div>
                )}

                {ticket.closed_at && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Closed</p>
                      <p className="text-sm text-gray-900">{formatDate(ticket.closed_at)}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm text-gray-900">{formatDate(ticket.updated_at)}</p>
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
