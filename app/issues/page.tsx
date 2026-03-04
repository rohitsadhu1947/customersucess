"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Filter,
  Search,
  Save,
  X,
  Eye,
  Table2,
  Columns,
  Download,
  Building2,
  Shield,
  TrendingUp,
  DollarSign,
  UserCheck,
  BarChart3,
  Settings,
  Database,
  Zap,
  Calculator,
  MessageSquare,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exportIssues } from "@/lib/csv-export"

// Business-focused categories for comprehensive customer success tracking
const ISSUE_CATEGORIES = [
  "Insurer Integration",
  "Onboarding",
  "MIS",
  "Commissions",
  "Sales Journey",
  "CKYC",
  "Reports",
  "SSO",
  "Dashboard",
  "Reconciliation",
  "Payments",
]

const SUB_CATEGORIES = [
  // Insurance Products
  "2w",
  "4w",
  "CV",
  "Health",
  "Life",
  "Others",
  // Business Issues
  "New Reports",
  "Report Generation Issues",
  "Commission Mismatch",
  "Commission Rule Issue",
  "Access Not working",
  "POSP Onboarding",
  "SSO Failed",
  "SSO required",
  "New Payment Method",
  "PG Not working",
]

const STATUSES = ["Raised", "In Progress", "Blocked", "Resolved", "Escalated"]
const PRIORITIES = ["High", "Medium", "Low"]
const RESOLUTION_TYPES = ["Code Fix", "Change Request", "Workaround", "User Training", "Others"]

interface ProjectStatus {
  id: string
  company_id: string
  insurer_id: string
  title: string
  description: string
  issue_category: string
  sub_category: string
  status: string
  priority: string
  resolution_type: string
  raised_by_name: string
  assigned_to_name: string
  pending_with_name: string
  raised_by_id: string
  assigned_to_id: string
  pending_with_id: string
  due_date: string
  raised_date: string
  resolved_at: string
  followup_notes: string
  created_at: string
  updated_at: string
  company_name: string
  insurer_name: string
  insurer_short_name: string
  raised_by_user_name: string
  assigned_to_user_name: string
  pending_with_user_name: string
}

interface Company {
  id: string
  name: string
}

interface Insurer {
  id: string
  name: string
  short_name: string
}

interface User {
  id: string
  name: string
  email: string
  role_type: string
}

export default function ProjectStatusPage() {
  const { user, hasPermission } = useAuth()
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([])
  const [filteredStatuses, setFilteredStatuses] = useState<ProjectStatus[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [insurers, setInsurers] = useState<Insurer[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filter states
  const [statusFilter, setStatusFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [insurerFilter, setInsurerFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingStatus, setEditingStatus] = useState<ProjectStatus | null>(null)
  const [viewingStatus, setViewingStatus] = useState<ProjectStatus | null>(null)
  const [formData, setFormData] = useState<any>({})

  // View mode state
  const [viewMode, setViewMode] = useState<"table" | "card">("table")

  useEffect(() => {
    if (user && hasPermission("issues")) {
      fetchAllData()
    }
  }, [user])

  useEffect(() => {
    filterStatuses()
  }, [projectStatuses, statusFilter, categoryFilter, priorityFilter, companyFilter, insurerFilter, searchTerm])

  const fetchAllData = async () => {
    try {
      setError("")
      console.log("Starting data fetch...")

      // Fetch all data in parallel
      const [statusRes, companiesRes, insurersRes, usersRes] = await Promise.all([
        fetch("/api/issues"),
        fetch("/api/companies"),
        fetch("/api/master-data/insurers"),
        fetch("/api/users"),
      ])

      console.log("Response status codes:", {
        status: statusRes.status,
        companies: companiesRes.status,
        insurers: insurersRes.status,
        users: usersRes.status,
      })

      // Check if status response is ok
      if (!statusRes.ok) {
        const errorText = await statusRes.text()
        console.error("Status API error:", errorText)
        throw new Error(`Status API failed: ${errorText}`)
      }

      const [statusData, companiesData, insurersData, usersData] = await Promise.all([
        statusRes.json(),
        companiesRes.json(),
        insurersRes.json(),
        usersRes.json(),
      ])

      console.log("Raw API responses:", {
        statusData,
        companiesData,
        insurersData,
        usersData,
      })

      setProjectStatuses(Array.isArray(statusData) ? statusData : [])
      setCompanies(Array.isArray(companiesData) ? companiesData : [])
      setInsurers(Array.isArray(insurersData) ? insurersData : [])
      setUsers(Array.isArray(usersData) ? usersData : [])

      console.log("State updated with data:", {
        statusCount: Array.isArray(statusData) ? statusData.length : 0,
        companiesCount: Array.isArray(companiesData) ? companiesData.length : 0,
        insurersCount: Array.isArray(insurersData) ? insurersData.length : 0,
        usersCount: Array.isArray(usersData) ? usersData.length : 0,
      })
    } catch (error) {
      console.error("Error fetching data:", error)
      setError(`Failed to load project status data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const filterStatuses = () => {
    let filtered = [...projectStatuses]

    if (statusFilter) {
      filtered = filtered.filter((s) => s.status === statusFilter)
    }

    if (categoryFilter) {
      filtered = filtered.filter((s) => s.issue_category === categoryFilter)
    }

    if (priorityFilter) {
      filtered = filtered.filter((s) => s.priority === priorityFilter)
    }

    if (companyFilter) {
      filtered = filtered.filter((s) => s.company_id === companyFilter)
    }

    if (insurerFilter) {
      filtered = filtered.filter((s) => s.insurer_id === insurerFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.insurer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.assigned_to_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.pending_with_name?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredStatuses(filtered)
  }

  const openModal = (status: ProjectStatus | null = null) => {
    setEditingStatus(status)
    setShowModal(true)

    if (status) {
      setFormData({ ...status })
    } else {
      setFormData({
        company_id: user?.companyId || "", // Always set company_id for all users
        insurer_id: "",
        title: "",
        description: "",
        issue_category: "Insurer Integration",
        sub_category: "",
        status: "Raised",
        priority: "Medium",
        assigned_to_id: "",
        assigned_to_name: "",
        pending_with_id: "",
        pending_with_name: "",
        due_date: "",
        resolution_type: "",
        followup_notes: "",
        raised_date: new Date().toISOString().split("T")[0],
      })
    }
  }

  const openDetailModal = (status: ProjectStatus) => {
    setViewingStatus(status)
    setShowDetailModal(true)
  }

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.company_id) {
        alert("Client Company is required")
        return
      }
      if (!formData.title) {
        alert("Title is required")
        return
      }
      if (!formData.description) {
        alert("Description is required")
        return
      }

      const method = editingStatus ? "PUT" : "POST"

      // Set names based on selected users
      const selectedAssignedUser = users.find((u) => u.id === formData.assigned_to_id)
      const selectedPendingUser = users.find((u) => u.id === formData.pending_with_id)

      if (selectedAssignedUser) {
        formData.assigned_to_name = selectedAssignedUser.name
      }
      if (selectedPendingUser) {
        formData.pending_with_name = selectedPendingUser.name
      }

      // Convert empty strings to null for optional UUID fields
      const payload = {
        ...formData,
        insurer_id: formData.insurer_id || null,
        assigned_to_id: formData.assigned_to_id || null,
        pending_with_id: formData.pending_with_id || null,
        resolution_type: formData.resolution_type || null,
      }

      console.log("Payload being sent:", payload)

      const response = await fetch("/api/issues", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to save project status: ${errorText}`)
      }

      setShowModal(false)
      fetchAllData()
    } catch (error: any) {
      console.error("Error saving:", error)
      alert(`Error saving project status: ${error.message}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project status item?")) return

    try {
      const response = await fetch(`/api/issues?id=${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchAllData()
      } else {
        const errorText = await response.text()
        alert(`Error deleting: ${errorText}`)
      }
    } catch (error) {
      console.error("Error deleting:", error)
      alert("Error deleting project status")
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      Raised: "bg-blue-100 text-blue-800",
      "In Progress": "bg-yellow-100 text-yellow-800",
      Blocked: "bg-red-100 text-red-800",
      Resolved: "bg-green-100 text-green-800",
      Escalated: "bg-orange-100 text-orange-800",
    }
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      High: "bg-red-100 text-red-800",
      Medium: "bg-yellow-100 text-yellow-800",
      Low: "bg-green-100 text-green-800",
    }
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      "Insurer Integration": Building2,
      Onboarding: UserCheck,
      MIS: Database,
      Commissions: DollarSign,
      "Sales Journey": TrendingUp,
      CKYC: Shield,
      Reports: BarChart3,
      SSO: Zap,
      Dashboard: Settings,
      Reconciliation: Calculator,
      Payments: DollarSign,
    }
    return icons[category as keyof typeof icons] || MessageSquare
  }

  const handleDownloadCSV = () => {
    if (filteredStatuses.length === 0) {
      alert("No data to export")
      return
    }

    exportIssues(filteredStatuses)
  }

  if (!hasPermission("issues")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view project status.</p>
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
            <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Project Status</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchAllData}>Retry</Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Project Status</h1>
              <p className="text-gray-600 mt-2">Comprehensive customer success project status tracking</p>
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
                  <Table2 className="h-4 w-4 mr-1" />
                  Table
                </Button>
                <Button
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="h-8"
                >
                  <Columns className="h-4 w-4 mr-1" />
                  Cards
                </Button>
              </div>

              {/* CSV Download Button */}
              <Button variant="outline" onClick={handleDownloadCSV} disabled={filteredStatuses.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV ({filteredStatuses.length})
              </Button>

              {hasPermission("issues") && (
                <Button onClick={() => openModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Project Status
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status-filter">Status</Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="category-filter">Category</Label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Categories</option>
                  {ISSUE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="priority-filter">Priority</Label>
                <select
                  id="priority-filter"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Priorities</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              {["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "") && (
                <>
                  <div>
                    <Label htmlFor="company-filter">Client</Label>
                    <select
                      id="company-filter"
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">All Clients</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="insurer-filter">Insurer</Label>
                    <select
                      id="insurer-filter"
                      value={insurerFilter}
                      onChange={(e) => setInsurerFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">All Insurers</option>
                      {insurers.map((insurer) => (
                        <option key={insurer.id} value={insurer.id}>
                          {insurer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("")
                    setCategoryFilter("")
                    setPriorityFilter("")
                    setCompanyFilter("")
                    setInsurerFilter("")
                    setSearchTerm("")
                  }}
                  className="w-full"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* Project Status List */}
          {filteredStatuses.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Status Items Found</h3>
              <p className="text-gray-600 mb-4">
                {projectStatuses.length === 0
                  ? "No project status items have been created yet."
                  : "No items match your current filters."}
              </p>
              {projectStatuses.length === 0 && (
                <Button onClick={() => openModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Project Status
                </Button>
              )}
            </div>
          ) : (
            <>
              {viewMode === "table" ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Insurer</TableHead>
                        <TableHead>Category → Sub Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Pending With</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Raised Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStatuses.map((status) => {
                        const CategoryIcon = getCategoryIcon(status.issue_category)
                        return (
                          <TableRow key={status.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                <CategoryIcon className="w-4 h-4 mr-2 text-gray-500" />
                                {status.title}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{status.company_name}</TableCell>
                            <TableCell>{status.insurer_short_name || status.insurer_name || "N/A"}</TableCell>
                            <TableCell>
                              {status.issue_category}
                              {status.sub_category && <span className="text-gray-500"> → {status.sub_category}</span>}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(status.status)}>{status.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPriorityColor(status.priority)}>{status.priority}</Badge>
                            </TableCell>
                            <TableCell>{status.pending_with_name || status.assigned_to_name || "Unassigned"}</TableCell>
                            <TableCell>
                              {status.due_date ? new Date(status.due_date).toLocaleDateString() : "N/A"}
                            </TableCell>
                            <TableCell>
                              {status.raised_date ? new Date(status.raised_date).toLocaleDateString() : "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="icon" variant="ghost" onClick={() => openDetailModal(status)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(
                                  user?.role || "",
                                ) && (
                                  <Button size="icon" variant="ghost" onClick={() => openModal(status)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                )}
                                {user?.role === "Admin" && (
                                  <Button size="icon" variant="ghost" onClick={() => handleDelete(status.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredStatuses.map((status) => {
                    const CategoryIcon = getCategoryIcon(status.issue_category)
                    return (
                      <div
                        key={status.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <CategoryIcon className="w-5 h-5 text-gray-500 mr-2" />
                              <h3 className="text-lg font-semibold text-gray-900">{status.title}</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{status.description}</p>
                            <p className="text-xs text-gray-500">
                              <span className="font-medium">{status.company_name}</span> • {status.insurer_name} •{" "}
                              {status.issue_category}
                              {status.sub_category && ` → ${status.sub_category}`}
                            </p>
                          </div>
                          <div className="flex space-x-1 ml-4">
                            <button
                              onClick={() => openDetailModal(status)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user?.role || "") && (
                              <button onClick={() => openModal(status)} className="text-blue-600 hover:text-blue-900">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {user?.role === "Admin" && (
                              <button
                                onClick={() => handleDelete(status.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex space-x-2">
                            <Badge className={getStatusColor(status.status)} variant="secondary">
                              {status.status}
                            </Badge>
                            <Badge className={getPriorityColor(status.priority)} variant="secondary">
                              {status.priority}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            {status.pending_with_name && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                <span>{status.pending_with_name}</span>
                              </div>
                            )}
                            {status.due_date && (
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                <span>{new Date(status.due_date).toLocaleDateString()}</span>
                              </div>
                            )}
                            <span>
                              Raised {status.raised_date ? new Date(status.raised_date).toLocaleDateString() : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">
                  {editingStatus ? "Edit Project Status" : "Add New Project Status"}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="company_id">Client Company *</Label>
                    <select
                      id="company_id"
                      value={formData.company_id || ""}
                      onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                      disabled={user?.role === "Customer"}
                    >
                      <option value="">Select Client</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {user?.role === "Customer" && (
                      <p className="text-sm text-gray-500 mt-1">Automatically set to your company</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="insurer_id">Insurance Partner</Label>
                    <select
                      id="insurer_id"
                      value={formData.insurer_id || ""}
                      onChange={(e) => setFormData({ ...formData, insurer_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select Insurer</option>
                      {insurers.map((insurer) => (
                        <option key={insurer.id} value={insurer.id}>
                          {insurer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title || ""}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Brief description of the project status"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed description..."
                      rows={4}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="followup_notes">Follow-up Notes</Label>
                    <Textarea
                      id="followup_notes"
                      value={formData.followup_notes || ""}
                      onChange={(e) => setFormData({ ...formData, followup_notes: e.target.value })}
                      placeholder="Progress updates and follow-up notes..."
                      rows={3}
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="issue_category">Business Area *</Label>
                      <select
                        id="issue_category"
                        value={formData.issue_category || "Insurer Integration"}
                        onChange={(e) => setFormData({ ...formData, issue_category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      >
                        {ISSUE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="sub_category">Sub Category</Label>
                      <select
                        id="sub_category"
                        value={formData.sub_category || ""}
                        onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Sub Category</option>
                        {SUB_CATEGORIES.map((subCat) => (
                          <option key={subCat} value={subCat}>
                            {subCat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <select
                        id="status"
                        value={formData.status || "Raised"}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <select
                        id="priority"
                        value={formData.priority || "Medium"}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="assigned_to_id">Assigned To</Label>
                    <select
                      id="assigned_to_id"
                      value={formData.assigned_to_id || ""}
                      onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="pending_with_id">Currently Pending With</Label>
                    <select
                      id="pending_with_id"
                      value={formData.pending_with_id || ""}
                      onChange={(e) => setFormData({ ...formData, pending_with_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Not Pending</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.role_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="raised_date">Raised Date</Label>
                      <Input
                        id="raised_date"
                        type="date"
                        value={formData.raised_date || ""}
                        onChange={(e) => setFormData({ ...formData, raised_date: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="due_date">Due Date</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date || ""}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="resolution_type">Resolution Type</Label>
                    <select
                      id="resolution_type"
                      value={formData.resolution_type || ""}
                      onChange={(e) => setFormData({ ...formData, resolution_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select Resolution Type</option>
                      {RESOLUTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingStatus ? "Update" : "Create"} Project Status
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && viewingStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-semibold">{viewingStatus.title}</h3>
                  <p className="text-gray-600">
                    <span className="font-medium">{viewingStatus.company_name}</span> • {viewingStatus.insurer_name} •{" "}
                    {viewingStatus.issue_category}
                    {viewingStatus.sub_category && ` → ${viewingStatus.sub_category}`}
                  </p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h4 className="font-medium text-gray-900 mb-3">Description</h4>
                  <p className="text-gray-700 mb-6">{viewingStatus.description}</p>

                  {viewingStatus.followup_notes && (
                    <>
                      <h4 className="font-medium text-gray-900 mb-3">Follow-up Notes</h4>
                      <p className="text-gray-700 mb-6 bg-gray-50 p-4 rounded-lg">{viewingStatus.followup_notes}</p>
                    </>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Project Status Details</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Status</span>
                      <div className="mt-1">
                        <Badge className={getStatusColor(viewingStatus.status)} variant="secondary">
                          {viewingStatus.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Priority</span>
                      <div className="mt-1">
                        <Badge className={getPriorityColor(viewingStatus.priority)} variant="secondary">
                          {viewingStatus.priority}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Raised By</span>
                      <div className="text-sm text-gray-900">{viewingStatus.raised_by_name}</div>
                    </div>
                    {viewingStatus.assigned_to_name && (
                      <div>
                        <span className="text-sm text-gray-500">Assigned To</span>
                        <div className="text-sm text-gray-900">{viewingStatus.assigned_to_name}</div>
                      </div>
                    )}
                    {viewingStatus.pending_with_name && (
                      <div>
                        <span className="text-sm text-gray-500">Pending With</span>
                        <div className="text-sm text-gray-900">{viewingStatus.pending_with_name}</div>
                      </div>
                    )}
                    {viewingStatus.raised_date && (
                      <div>
                        <span className="text-sm text-gray-500">Raised Date</span>
                        <div className="text-sm text-gray-900">
                          {new Date(viewingStatus.raised_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {viewingStatus.due_date && (
                      <div>
                        <span className="text-sm text-gray-500">Due Date</span>
                        <div className="text-sm text-gray-900">
                          {new Date(viewingStatus.due_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {viewingStatus.resolved_at && (
                      <div>
                        <span className="text-sm text-gray-500">Resolved</span>
                        <div className="text-sm text-gray-900">
                          {new Date(viewingStatus.resolved_at).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {viewingStatus.resolution_type && (
                      <div>
                        <span className="text-sm text-gray-500">Resolution Type</span>
                        <div className="text-sm text-gray-900">{viewingStatus.resolution_type}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
