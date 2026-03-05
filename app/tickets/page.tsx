"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Search,
  Download,
  LayoutGrid,
  List,
  Filter,
  Clock,
  AlertCircle,
  User,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  X,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { exportTickets } from "@/lib/csv-export"
import { getSlaStatus } from "@/lib/sla"
import { TICKET_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES, ATTACHMENT_MAX_FILE_SIZE, ATTACHMENT_ALLOWED_EXTENSIONS, formatFileSize } from "@/lib/validations"

// ---- Types ----

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  sub_category: string | null
  priority: string
  status: string
  company_id: string
  company_name: string
  created_by_id: string
  created_by_name: string
  assigned_to_id: string | null
  assigned_to_name: string | null
  assigned_group: string | null
  tags: string[]
  source: string
  sla_breach: boolean
  due_date: string | null
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

interface TicketStats {
  open: number
  myTickets: number
  overdue: number
}

interface Company {
  id: string
  name: string
}

interface UserOption {
  id: string
  name: string
  email: string
  role_type: string
  is_active: boolean
}

// ---- Constants ----

const KANBAN_STATUSES = ["New", "Open", "In Progress", "Waiting on Customer", "Waiting on Internal", "Escalated"]

const STATUS_COLORS: Record<string, string> = {
  New: "bg-gray-100 text-gray-800",
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-indigo-100 text-indigo-800",
  "Waiting on Customer": "bg-amber-100 text-amber-800",
  "Waiting on Internal": "bg-purple-100 text-purple-800",
  Escalated: "bg-red-100 text-red-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-800",
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-blue-100 text-blue-800",
  Low: "bg-gray-100 text-gray-800",
}

const SLA_DOT_COLORS: Record<string, string> = {
  ok: "bg-green-500",
  warning: "bg-yellow-500",
  breached: "bg-red-500",
}

// ---- Helpers ----

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function isEnsureditRole(role: string | undefined): boolean {
  return ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(role || "")
}

// ---- Component ----

export default function TicketsPage() {
  const { user, hasPermission } = useAuth()
  const router = useRouter()

  // Data
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<TicketStats>({ open: 0, myTickets: 0, overdue: 0 })
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  // Filters
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [quickFilter, setQuickFilter] = useState<"" | "my" | "unassigned" | "overdue">("")
  const [page, setPage] = useState(1)
  const limit = 50

  // Create form
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    category: "",
    priority: "Medium",
    company_id: "",
    assigned_to_id: "",
    tags: "",
  })

  // ---- Data Fetching ----

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", String(limit))
    if (searchTerm) params.set("search", searchTerm)
    if (statusFilter) params.set("status", statusFilter)
    if (priorityFilter) params.set("priority", priorityFilter)
    if (categoryFilter) params.set("category", categoryFilter)
    if (companyFilter) params.set("company_id", companyFilter)
    if (quickFilter === "my") params.set("my_tickets", "true")
    if (quickFilter === "unassigned") params.set("unassigned", "true")
    if (quickFilter === "overdue") params.set("overdue", "true")
    return params.toString()
  }, [page, searchTerm, statusFilter, priorityFilter, categoryFilter, companyFilter, quickFilter])

  const fetchTickets = useCallback(async () => {
    try {
      const qs = buildQueryString()
      const res = await fetch(`/api/tickets?${qs}`)
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText)
      }
      const data = await res.json()
      setTickets(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalCount(data.pagination?.total || 0)
    } catch (err) {
      console.error("Error fetching tickets:", err)
      setError(`Failed to load tickets: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [buildQueryString])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets/stats")
      if (res.ok) {
        const data = await res.json()
        setStats({
          open: data.open || 0,
          myTickets: data.myTickets || 0,
          overdue: data.overdue || 0,
        })
      }
    } catch {
      // Stats are non-critical
    }
  }, [])

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies")
      if (res.ok) {
        const data = await res.json()
        setCompanies(Array.isArray(data) ? data : [])
      }
    } catch {
      // Non-critical
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        const allUsers = Array.isArray(data) ? data : []
        setUsers(allUsers.filter((u: UserOption) =>
          u.is_active !== false && ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(u.role_type)
        ))
      }
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    if (user && hasPermission("tickets")) {
      const loadData = async () => {
        setLoading(true)
        setError("")
        await Promise.all([
          fetchTickets(),
          fetchStats(),
          ...(isEnsureditRole(user.role) ? [fetchCompanies(), fetchUsers()] : []),
        ])
        setLoading(false)
      }
      loadData()
    }
  }, [user])

  // Refetch tickets when page changes (page changes are always explicit, no reset needed)
  useEffect(() => {
    if (user && hasPermission("tickets") && !loading) {
      fetchTickets()
    }
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // When filters change, reset to page 1 and fetch
  useEffect(() => {
    if (user && hasPermission("tickets") && !loading) {
      if (page === 1) {
        fetchTickets()
      } else {
        setPage(1) // this will trigger the page effect above
      }
    }
  }, [searchTerm, statusFilter, priorityFilter, categoryFilter, companyFilter, quickFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search input
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(searchInput)
    }, 400)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchInput])

  // ---- File Selection ----

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const combined = [...selectedFiles, ...validFiles]
    if (combined.length > 5) {
      alert("Maximum 5 files allowed")
      return
    }
    setSelectedFiles(combined)
    // Reset the input so the same file can be re-selected
    e.target.value = ""
  }

  // ---- Create Ticket ----

  const handleCreateTicket = async () => {
    if (!formData.subject.trim()) {
      alert("Subject is required")
      return
    }
    if (!formData.description.trim()) {
      alert("Description is required")
      return
    }
    if (!formData.category) {
      alert("Category is required")
      return
    }

    const companyId = isEnsureditRole(user?.role) ? formData.company_id : (user?.companyId || "")
    if (!companyId) {
      alert("Company is required")
      return
    }

    setSubmitting(true)
    try {
      const selectedUser = users.find((u) => u.id === formData.assigned_to_id)
      const payload = {
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
        company_id: companyId,
        assigned_to_id: formData.assigned_to_id || null,
        assigned_to_name: selectedUser?.name || null,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText)
      }

      const ticket = await res.json()

      // Upload attachments if any
      if (selectedFiles.length > 0) {
        const uploadData = new FormData()
        selectedFiles.forEach(file => uploadData.append("files", file))
        const uploadRes = await fetch(`/api/tickets/${ticket.id}/attachments`, {
          method: "POST",
          body: uploadData,
        })
        if (!uploadRes.ok) {
          console.error("Attachment upload failed:", await uploadRes.text())
          alert("Ticket created, but some attachments failed to upload. You can add them later.")
        }
      }

      setShowCreateDialog(false)
      setSelectedFiles([])
      setFormData({
        subject: "",
        description: "",
        category: "",
        priority: "Medium",
        company_id: "",
        assigned_to_id: "",
        tags: "",
      })
      fetchTickets()
      fetchStats()
    } catch (err: any) {
      console.error("Error creating ticket:", err)
      alert(`Error creating ticket: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ---- CSV Export ----

  const handleExportCSV = () => {
    if (tickets.length === 0) {
      alert("No data to export")
      return
    }
    exportTickets(tickets)
  }

  // ---- Quick Filter Toggle ----

  const toggleQuickFilter = (filter: "my" | "unassigned" | "overdue") => {
    setQuickFilter((prev) => (prev === filter ? "" : filter))
  }

  // ---- Clear All Filters ----

  const clearFilters = () => {
    setSearchInput("")
    setSearchTerm("")
    setStatusFilter("")
    setPriorityFilter("")
    setCategoryFilter("")
    setCompanyFilter("")
    setQuickFilter("")
    setPage(1)
  }

  // ---- SLA Dot ----

  const renderSlaDot = (ticket: Ticket) => {
    const slaStatus = getSlaStatus(
      ticket.priority,
      ticket.created_at,
      ticket.first_response_at,
      ticket.resolved_at,
      ticket.due_date,
    )
    return (
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${SLA_DOT_COLORS[slaStatus]}`}
        title={`SLA: ${slaStatus}`}
      />
    )
  }

  // ---- Permission Gate ----

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

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Tickets</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => { setError(""); setLoading(true); fetchTickets().then(() => setLoading(false)) }}>
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const isCustomerViewOnly = user?.role === "Customer View Only"
  const isEnsuredit = isEnsureditRole(user?.role)

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* ---- Header ---- */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
            <div>
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Open: {stats.open}
                  </Badge>
                  <Badge variant="outline" className="text-indigo-700 border-indigo-300 bg-indigo-50">
                    <User className="w-3 h-3 mr-1" />
                    My Tickets: {stats.myTickets}
                  </Badge>
                  <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                    <Clock className="w-3 h-3 mr-1" />
                    Overdue: {stats.overdue}
                  </Badge>
                </div>
              </div>
              <p className="text-gray-600 mt-1">
                {totalCount} ticket{totalCount !== 1 ? "s" : ""} total
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* View Toggle */}
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-8"
                >
                  <List className="h-4 w-4 mr-1" />
                  Table
                </Button>
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="h-8"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Kanban
                </Button>
              </div>

              {/* CSV Export */}
              <Button variant="outline" onClick={handleExportCSV} disabled={tickets.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>

              {/* New Ticket */}
              {!isCustomerViewOnly && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Ticket
                </Button>
              )}
            </div>
          </div>

          {/* ---- Filters ---- */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col gap-4">
              {/* Top row: Search + Quick Filters */}
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search ticket #, subject, description..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={quickFilter === "my" ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleQuickFilter("my")}
                  >
                    <User className="w-3.5 h-3.5 mr-1" />
                    My Tickets
                  </Button>
                  {isEnsuredit && (
                    <Button
                      variant={quickFilter === "unassigned" ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleQuickFilter("unassigned")}
                    >
                      Unassigned
                    </Button>
                  )}
                  <Button
                    variant={quickFilter === "overdue" ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleQuickFilter("overdue")}
                  >
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Overdue
                  </Button>
                </div>
              </div>

              {/* Bottom row: Dropdown Filters */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                <div>
                  <Label htmlFor="status-filter" className="text-xs text-gray-500">Status</Label>
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">All Statuses</option>
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="priority-filter" className="text-xs text-gray-500">Priority</Label>
                  <select
                    id="priority-filter"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">All Priorities</option>
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="category-filter" className="text-xs text-gray-500">Category</Label>
                  <select
                    id="category-filter"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">All Categories</option>
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {isEnsuredit && (
                  <div>
                    <Label htmlFor="company-filter" className="text-xs text-gray-500">Company</Label>
                    <select
                      id="company-filter"
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">All Companies</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-end">
                  <Button variant="outline" onClick={clearFilters} className="w-full" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Empty State ---- */}
          {tickets.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Tickets Found</h3>
              <p className="text-gray-600 mb-4">
                {totalCount === 0 && !searchInput && !statusFilter && !priorityFilter && !categoryFilter && !companyFilter && !quickFilter
                  ? "No tickets have been created yet."
                  : "No tickets match your current filters."}
              </p>
              {totalCount === 0 && !isCustomerViewOnly && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Ticket
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ---- Table View ---- */}
              {viewMode === "table" && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket #</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket) => (
                        <TableRow
                          key={ticket.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => router.push(`/tickets/${ticket.id}`)}
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {renderSlaDot(ticket)}
                              <span>{ticket.ticket_number}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate" title={ticket.subject}>
                            {ticket.subject}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{ticket.category}</TableCell>
                          <TableCell>
                            <Badge className={PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-800"}>
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-800"}>
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{ticket.company_name}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {ticket.assigned_to_name || <span className="text-gray-400">Unassigned</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-gray-500 text-sm">
                            {formatDateTime(ticket.created_at)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-gray-500 text-sm">
                            {formatDateTime(ticket.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* ---- Kanban View ---- */}
              {viewMode === "kanban" && (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {KANBAN_STATUSES.map((kanbanStatus) => {
                    const columnTickets = tickets.filter((t) => t.status === kanbanStatus)
                    return (
                      <div key={kanbanStatus} className="flex-shrink-0 w-72">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700">{kanbanStatus}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {columnTickets.length}
                            </Badge>
                          </div>
                          <div className="space-y-2 min-h-[100px]">
                            {columnTickets.map((ticket) => (
                              <div
                                key={ticket.id}
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => router.push(`/tickets/${ticket.id}`)}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {renderSlaDot(ticket)}
                                  <span className="text-xs font-mono text-gray-500">{ticket.ticket_number}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                                  {ticket.subject}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                  <Badge className={`text-xs ${PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-800"}`}>
                                    {ticket.priority}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span className="truncate max-w-[120px]" title={ticket.company_name}>
                                    {ticket.company_name}
                                  </span>
                                  <span className="truncate max-w-[100px]" title={ticket.assigned_to_name || "Unassigned"}>
                                    {ticket.assigned_to_name || "Unassigned"}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {columnTickets.length === 0 && (
                              <div className="text-center text-xs text-gray-400 py-6">
                                No tickets
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ---- Pagination ---- */}
              {viewMode === "table" && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Page {page} of {totalPages} ({totalCount} tickets)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    {/* Page number buttons */}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 7) {
                        pageNum = i + 1
                      } else if (page <= 4) {
                        pageNum = i + 1
                      } else if (page >= totalPages - 3) {
                        pageNum = totalPages - 6 + i
                      } else {
                        pageNum = page - 3 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="w-9"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---- Create Ticket Dialog ---- */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="ticket-subject">Subject *</Label>
              <Input
                id="ticket-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief summary of the issue"
                maxLength={500}
              />
            </div>

            <div>
              <Label htmlFor="ticket-description">Description *</Label>
              <Textarea
                id="ticket-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the issue..."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ticket-category">Category *</Label>
                <select
                  id="ticket-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select Category</option>
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="ticket-priority">Priority</Label>
                <select
                  id="ticket-priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {isEnsuredit && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ticket-company">Company *</Label>
                  <select
                    id="ticket-company"
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select Company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="ticket-assigned">Assign To</Label>
                  <select
                    id="ticket-assigned"
                    value={formData.assigned_to_id}
                    onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role_type})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {!isEnsuredit && user?.companyId && (
              <p className="text-sm text-gray-500">
                Company: <span className="font-medium">{user.companyName || "Your company"}</span> (auto-assigned)
              </p>
            )}

            <div>
              <Label htmlFor="ticket-tags">Tags</Label>
              <Input
                id="ticket-tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="Comma-separated tags, e.g. urgent, api, login"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
            </div>

            {/* File Attachments */}
            <div>
              <Label>Attachments</Label>
              <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="ticket-create-files"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                />
                <label htmlFor="ticket-create-files" className="cursor-pointer">
                  <Paperclip className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-sm text-gray-500">Click to attach files</p>
                  <p className="text-xs text-gray-400 mt-1">Max 5 files, 5MB each</p>
                </label>
              </div>
              {selectedFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {selectedFiles.map((file, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                      <span className="truncate">{file.name} <span className="text-gray-400">({formatFileSize(file.size)})</span></span>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false)
              setSelectedFiles([])
              setFormData({ subject: "", description: "", category: "", priority: "Medium", company_id: "", assigned_to_id: "", tags: "" })
            }} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket} disabled={submitting}>
              {submitting ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
