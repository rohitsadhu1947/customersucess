"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MessageSquare,
  History,
  Send,
  User,
  Building2,
  AlertTriangle,
  Lock,
} from "lucide-react"

interface Issue {
  id: string
  title: string
  description: string
  company_name: string
  company_id: string
  insurer_name: string
  issue_category: string
  sub_category: string
  status: string
  priority: string
  raised_by_user_name: string
  assigned_to_user_name: string
  pending_with_user_name: string
  due_date: string
  resolution_type: string
  followup_notes: string
  raised_date: string
  resolved_at: string
  created_at: string
  updated_at: string
}

interface Comment {
  id: number
  user_name: string
  comment: string
  is_internal: boolean
  created_at: string
}

interface HistoryEntry {
  id: number
  user_name: string
  action: string
  field_name: string
  old_value: string
  new_value: string
  created_at: string
}

export default function IssueDetailPage() {
  const { user, hasPermission } = useAuth()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [issue, setIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments")
  const [newComment, setNewComment] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isEnsuredit = ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "")

  useEffect(() => {
    if (user && id) {
      fetchIssue()
      fetchComments()
      fetchHistory()
    }
  }, [user, id])

  const fetchIssue = async () => {
    try {
      const res = await fetch(`/api/issues/${id}`)
      if (res.ok) {
        setIssue(await res.json())
      }
    } catch (error) {
      console.error("Error fetching issue:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/issues/${id}/comments`)
      if (res.ok) {
        setComments(await res.json())
      }
    } catch {
      // Comments table may not exist yet
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/issues/${id}/history`)
      if (res.ok) {
        setHistory(await res.json())
      }
    } catch {
      // History table may not exist yet
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/issues/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment, is_internal: isInternal }),
      })
      if (res.ok) {
        setNewComment("")
        setIsInternal(false)
        fetchComments()
      }
    } catch (error) {
      console.error("Error adding comment:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Raised: "bg-blue-100 text-blue-800",
      "In Progress": "bg-yellow-100 text-yellow-800",
      Blocked: "bg-red-100 text-red-800",
      Escalated: "bg-red-100 text-red-800",
      Resolved: "bg-green-100 text-green-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      Critical: "bg-red-100 text-red-800",
      High: "bg-orange-100 text-orange-800",
      Medium: "bg-yellow-100 text-yellow-800",
      Low: "bg-green-100 text-green-800",
    }
    return colors[priority] || "bg-gray-100 text-gray-800"
  }

  if (!hasPermission("issues")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don&apos;t have permission to view issues.</p>
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

  if (!issue) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Issue Not Found</h1>
            <Button onClick={() => router.push("/issues")} variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Issues
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button onClick={() => router.push("/issues")} variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Issues
            </Button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{issue.title}</h1>
                <p className="text-gray-500 mt-1">Issue #{issue.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getPriorityColor(issue.priority)}>{issue.priority}</Badge>
                <Badge className={getStatusColor(issue.status)}>{issue.status}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{issue.description || "No description provided."}</p>
              </div>

              {/* Follow-up Notes */}
              {issue.followup_notes && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Follow-up Notes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{issue.followup_notes}</p>
                </div>
              )}

              {/* Tabs: Comments / History */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab("comments")}
                      className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "comments"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Comments ({comments.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("history")}
                      className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "history"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <History className="h-4 w-4 mr-2" />
                      History ({history.length})
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === "comments" ? (
                    <div className="space-y-4">
                      {comments.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No comments yet. Be the first to comment.</p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className={`p-4 rounded-lg ${c.is_internal ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-600 w-7 h-7 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-medium">
                                    {c.user_name?.split(" ").map((n) => n[0]).join("") || "?"}
                                  </span>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{c.user_name}</span>
                                {c.is_internal && (
                                  <span className="flex items-center text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Internal
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(c.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
                          </div>
                        ))
                      )}

                      {/* Add Comment */}
                      {user?.role !== "Customer View Only" && (
                        <div className="pt-4 border-t border-gray-200">
                          <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment..."
                            rows={3}
                          />
                          <div className="flex items-center justify-between mt-3">
                            <div>
                              {isEnsuredit && (
                                <label className="flex items-center text-sm text-gray-600">
                                  <input
                                    type="checkbox"
                                    checked={isInternal}
                                    onChange={(e) => setIsInternal(e.target.checked)}
                                    className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 mr-2"
                                  />
                                  <Lock className="h-3 w-3 mr-1" />
                                  Internal note (not visible to customers)
                                </label>
                              )}
                            </div>
                            <Button onClick={handleAddComment} disabled={!newComment.trim() || submitting} size="sm">
                              <Send className="h-4 w-4 mr-2" />
                              {submitting ? "Sending..." : "Send"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No history recorded yet.</p>
                      ) : (
                        history.map((h) => (
                          <div key={h.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="bg-gray-200 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="h-3.5 w-3.5 text-gray-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">
                                <span className="font-medium text-gray-900">{h.user_name}</span>
                                {" "}
                                {h.action === "create" && "created this issue"}
                                {h.action === "update" && h.field_name && (
                                  <>
                                    changed <span className="font-medium">{h.field_name}</span>
                                    {h.old_value && (
                                      <> from <span className="text-red-600 line-through">{h.old_value}</span></>
                                    )}
                                    {h.new_value && (
                                      <> to <span className="text-green-600">{h.new_value}</span></>
                                    )}
                                  </>
                                )}
                                {h.action === "update" && !h.field_name && "updated this issue"}
                                {h.action === "delete" && "deleted this issue"}
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(h.created_at).toLocaleString()}
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

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Details</h3>

                <div>
                  <p className="text-xs text-gray-500">Company</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{issue.company_name}</span>
                  </div>
                </div>

                {issue.insurer_name && (
                  <div>
                    <p className="text-xs text-gray-500">Insurer</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{issue.insurer_name}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {issue.issue_category}
                    {issue.sub_category && ` / ${issue.sub_category}`}
                  </p>
                </div>

                {issue.resolution_type && (
                  <div>
                    <p className="text-xs text-gray-500">Resolution Type</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{issue.resolution_type}</p>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-xs text-gray-500 mb-3">People</h4>

                  {issue.raised_by_user_name && (
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Raised by</p>
                        <p className="text-sm text-gray-900">{issue.raised_by_user_name}</p>
                      </div>
                    </div>
                  )}

                  {issue.assigned_to_user_name && (
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Assigned to</p>
                        <p className="text-sm text-gray-900">{issue.assigned_to_user_name}</p>
                      </div>
                    </div>
                  )}

                  {issue.pending_with_user_name && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                      <div>
                        <p className="text-xs text-gray-500">Pending with</p>
                        <p className="text-sm text-gray-900">{issue.pending_with_user_name}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-xs text-gray-500 mb-3">Dates</h4>

                  {issue.raised_date && (
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Raised</p>
                        <p className="text-sm text-gray-900">{new Date(issue.raised_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}

                  {issue.due_date && (
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Due date</p>
                        <p className="text-sm text-gray-900">{new Date(issue.due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}

                  {issue.resolved_at && (
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-xs text-gray-500">Resolved</p>
                        <p className="text-sm text-gray-900">{new Date(issue.resolved_at).toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Last updated</p>
                      <p className="text-sm text-gray-900">{new Date(issue.updated_at).toLocaleString()}</p>
                    </div>
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
