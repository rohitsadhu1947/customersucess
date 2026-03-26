"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Save,
  X,
  Package,
  Eye,
  TableIcon,
  LayoutGrid,
  Download,
} from "lucide-react"
import { exportIntegrationProjects } from "@/lib/csv-export"

interface IntegrationProject {
  id: string
  company_id: string
  product_id: string
  sub_product_id: string
  insurer_id: string
  status: string
  priority: string
  api_kit_received: boolean
  api_kit_received_date: string
  creds_verified: boolean
  creds_verification_date: string
  dev_required: boolean
  dev_start_date: string
  dev_end_date: string
  dev_estimated_hours: number
  internal_testing_start_date: string
  internal_testing_end_date: string
  insurer_uat_creds_received: boolean
  insurer_uat_start_date: string
  insurer_uat_end_date: string
  prod_creds_received: boolean
  prod_cred_receipt_date: string
  go_live_date: string
  go_live_planned_date: string
  current_blockers: string
  technical_notes: string
  business_notes: string
  created_at: string
  updated_at: string
  company_name: string
  product_name: string
  product_display_name: string
  product_code: string
  sub_product_name: string
  sub_product_display_name: string
  sub_product_code: string
  sub_product_category: string
  insurer_name: string
  insurer_short_name: string
  insurer_code: string
  created_by_name: string
}

interface Company {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  display_name: string
  code: string
}

interface SubProduct {
  id: string
  name: string
  display_name: string
  code: string
  category: string
  product_name: string
}

interface Insurer {
  id: string
  name: string
  short_name: string
  code: string
}

export default function IntegrationsPage() {
  const { user, hasPermission } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<IntegrationProject[]>([])
  const [filteredProjects, setFilteredProjects] = useState<IntegrationProject[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [subProducts, setSubProducts] = useState<SubProduct[]>([])
  const [insurers, setInsurers] = useState<Insurer[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")

  // Filter states
  const [statusFilter, setStatusFilter] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingProject, setEditingProject] = useState<IntegrationProject | null>(null)
  const [viewingProject, setViewingProject] = useState<IntegrationProject | null>(null)
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (user && hasPermission("integrations")) {
      fetchAllData()
    }
  }, [user])

  useEffect(() => {
    filterProjects()
  }, [projects, statusFilter, companyFilter, priorityFilter, searchTerm])

  const fetchAllData = async () => {
    try {
      setError("")

      // Fetch all data in parallel
      const [projectsRes, companiesRes, productsRes, subProductsRes, insurersRes] = await Promise.all([
        fetch("/api/integration-projects"),
        fetch("/api/companies"),
        fetch("/api/master-data/products"),
        fetch("/api/master-data/sub-products"),
        fetch("/api/master-data/insurers"),
      ])

      const [projectsData, companiesData, productsData, subProductsData, insurersData] = await Promise.all([
        projectsRes.json(),
        companiesRes.json(),
        productsRes.json(),
        subProductsRes.json(),
        insurersRes.json(),
      ])

      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setCompanies(Array.isArray(companiesData) ? companiesData : [])
      setProducts(Array.isArray(productsData) ? productsData : [])
      setSubProducts(Array.isArray(subProductsData) ? subProductsData : [])
      setInsurers(Array.isArray(insurersData) ? insurersData : [])
    } catch (error) {
      console.error("Error fetching data:", error)
      setError("Failed to load integration projects.")
    } finally {
      setLoading(false)
    }
  }

  const filterProjects = () => {
    let filtered = [...projects]

    if (statusFilter) {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }

    if (companyFilter) {
      filtered = filtered.filter((p) => p.company_id === companyFilter)
    }

    if (priorityFilter) {
      filtered = filtered.filter((p) => p.priority === priorityFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.insurer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sub_product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.product_name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredProjects(filtered)
  }

  // Helper to format ISO date strings to YYYY-MM-DD for date inputs
  const toDateInput = (val: string | null | undefined) => {
    if (!val) return ""
    try {
      return new Date(val).toISOString().split("T")[0]
    } catch {
      return val?.split?.("T")?.[0] || ""
    }
  }

  const openModal = (project: IntegrationProject | null = null) => {
    setEditingProject(project)
    setShowModal(true)

    if (project) {
      setFormData({
        ...project,
        api_kit_received_date: toDateInput(project.api_kit_received_date),
        creds_verification_date: toDateInput(project.creds_verification_date),
        dev_start_date: toDateInput(project.dev_start_date),
        dev_end_date: toDateInput(project.dev_end_date),
        internal_testing_start_date: toDateInput(project.internal_testing_start_date),
        internal_testing_end_date: toDateInput(project.internal_testing_end_date),
        insurer_uat_start_date: toDateInput(project.insurer_uat_start_date),
        insurer_uat_end_date: toDateInput(project.insurer_uat_end_date),
        prod_cred_receipt_date: toDateInput(project.prod_cred_receipt_date),
        go_live_date: toDateInput(project.go_live_date),
        go_live_planned_date: toDateInput(project.go_live_planned_date),
      })
    } else {
      setFormData({
        company_id: user?.role === "Customer" ? user.companyId : "",
        product_id: "",
        sub_product_id: "",
        insurer_id: "",
        status: "Not Started",
        priority: "Medium",
        api_kit_received: false,
        creds_verified: false,
        dev_required: true,
        insurer_uat_creds_received: false,
        prod_creds_received: false,
        current_blockers: "",
        technical_notes: "",
        business_notes: "",
      })
    }
  }

  const openDetailModal = (project: IntegrationProject) => {
    setViewingProject(project)
    setShowDetailModal(true)
  }

  const handleSave = async () => {
    try {
      const method = editingProject ? "PUT" : "POST"

      const response = await fetch("/api/integration-projects", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setShowModal(false)
        fetchAllData()
      } else {
        const errorText = await response.text()
        alert(`Error saving: ${errorText}`)
      }
    } catch (error) {
      console.error("Error saving:", error)
      alert("Error saving project")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this integration project?")) return

    try {
      const response = await fetch(`/api/integration-projects?id=${id}`, {
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
      alert("Error deleting project")
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      "Not Started": "bg-gray-100 text-gray-800",
      "API Kit Requested": "bg-yellow-100 text-yellow-800",
      "Credentials Pending": "bg-orange-100 text-orange-800",
      Development: "bg-blue-100 text-blue-800",
      "Internal Testing": "bg-purple-100 text-purple-800",
      "UAT in Progress": "bg-indigo-100 text-indigo-800",
      "Production Ready": "bg-green-100 text-green-800",
      "Go Live": "bg-green-100 text-green-800",
      "On Hold": "bg-red-100 text-red-800",
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

  const getProgressPercentage = (project: IntegrationProject) => {
    let progress = 0
    if (project.api_kit_received) progress += 15
    if (project.creds_verified) progress += 15
    if (project.dev_end_date) progress += 25
    if (project.internal_testing_end_date) progress += 15
    if (project.insurer_uat_creds_received) progress += 10
    if (project.insurer_uat_end_date) progress += 10
    if (project.prod_creds_received) progress += 5
    if (project.go_live_date) progress += 5
    return progress
  }

  const getCurrentStage = (project: IntegrationProject) => {
    if (project.go_live_date) return "Go Live"
    if (project.prod_creds_received) return "Ready for Production"
    if (project.insurer_uat_end_date) return "UAT Complete"
    if (project.insurer_uat_creds_received) return "UAT"
    if (project.internal_testing_end_date) return "Testing Complete"
    if (project.internal_testing_start_date) return "Testing"
    if (project.dev_end_date) return "Development Complete"
    if (project.dev_start_date) return "In Development"
    if (project.creds_verified) return "Credentials Verified"
    if (project.api_kit_received) return "API Kit Received"
    return "Not Started"
  }

  const getKeyDates = (project: IntegrationProject) => {
    const startDate = project.dev_start_date || project.api_kit_received_date
    const endDate = project.go_live_date || project.go_live_planned_date

    if (!startDate && !endDate) return "-"
    if (!endDate) return `Target: ${new Date(endDate).toLocaleDateString()}`
    if (!startDate) return `Started: ${new Date(startDate).toLocaleDateString()}`

    return `${new Date(startDate).toLocaleDateString()} → ${new Date(endDate).toLocaleDateString()}`
  }

  const getProjectProgress = (project: IntegrationProject) => {
    const stages = [
      project.api_kit_received,
      project.creds_verified,
      project.dev_start_date ? true : false,
      project.internal_testing_start_date ? true : false,
      project.insurer_uat_creds_received,
      project.prod_creds_received,
      project.go_live_date ? true : false,
    ]

    const completedStages = stages.filter(Boolean).length
    return Math.round((completedStages / stages.length) * 100)
  }

  const handleDownloadCSV = () => {
    if (filteredProjects.length === 0) {
      alert("No data to export")
      return
    }

    exportIntegrationProjects(filteredProjects)
  }

  // Table View Component
  const TableView = () => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">Project</TableHead>
            <TableHead className="font-semibold">Product</TableHead>
            <TableHead className="font-semibold">Plan Name</TableHead>
            <TableHead className="font-semibold">Insurer</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Progress</TableHead>
            <TableHead className="font-semibold">Current Stage</TableHead>
            <TableHead className="font-semibold">Key Dates</TableHead>
            <TableHead className="font-semibold">Priority</TableHead>
            <TableHead className="font-semibold">Blockers</TableHead>
            <TableHead className="font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProjects.map((project) => (
            <TableRow key={project.id} className="hover:bg-gray-50">
              <TableCell className="font-medium">
                <div>
                  <div className="font-semibold text-sm">{project.company_name}</div>
                  <div className="text-xs text-gray-500">ID: {project.id.slice(0, 8)}</div>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-medium text-sm">{project.product_display_name || project.product_name}</span>
              </TableCell>
              <TableCell>
                <span className="font-medium text-sm text-blue-700">
                  {project.sub_product_display_name || project.sub_product_name || "—"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium">{project.insurer_short_name || project.insurer_name}</span>
              </TableCell>
              <TableCell>
                <Badge className={`text-xs ${getStatusColor(project.status)}`} variant="secondary">
                  {project.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Progress value={getProgressPercentage(project)} className="h-2" />
                  <span className="text-xs text-gray-600">{getProgressPercentage(project)}%</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium">{getCurrentStage(project)}</span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-gray-600">{getKeyDates(project)}</span>
              </TableCell>
              <TableCell>
                <Badge className={`text-xs ${getPriorityColor(project.priority)}`} variant="secondary">
                  {project.priority}
                </Badge>
              </TableCell>
              <TableCell>
                {project.current_blockers ? (
                  <div className="max-w-32">
                    <span className="text-xs text-red-600 truncate block" title={project.current_blockers}>
                      {project.current_blockers}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">None</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/integrations/${project.id}`)} className="h-8 w-8 p-0">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user?.role || "") && (
                    <Button variant="ghost" size="sm" onClick={() => openModal(project)} className="h-8 w-8 p-0">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {user?.role === "Admin" && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)} className="h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filteredProjects.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No projects found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      )}
    </div>
  )

  // Card View Component (existing functionality)
  const CardView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {filteredProjects.map((project) => (
        <div
          key={project.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {project.company_name} × {project.insurer_short_name || project.insurer_name}
              </h3>
              <p className="text-sm text-gray-600">
                {project.product_display_name || project.product_name}
              </p>
              {(project.sub_product_display_name || project.sub_product_name) && (
                <p className="text-sm font-medium text-blue-700 mt-1">
                  Plan: {project.sub_product_display_name || project.sub_product_name}
                </p>
              )}
            </div>
            <div className="flex space-x-1 ml-4">
              <button onClick={() => router.push(`/integrations/${project.id}`)} className="text-gray-600 hover:text-gray-900">
                <Eye className="w-4 h-4" />
              </button>
              {["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer"].includes(user?.role || "") && (
                <button onClick={() => openModal(project)} className="text-blue-600 hover:text-blue-900">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {user?.role === "Admin" && (
                <button onClick={() => handleDelete(project.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Badge className={getStatusColor(project.status)} variant="secondary">
                {project.status}
              </Badge>
              <Badge className={getPriorityColor(project.priority)} variant="secondary">
                {project.priority}
              </Badge>
            </div>

            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{getProjectProgress(project)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProjectProgress(project)}%` }}
                ></div>
              </div>
            </div>

            {project.go_live_planned_date && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                <span>Target: {new Date(project.go_live_planned_date).toLocaleDateString()}</span>
              </div>
            )}

            {project.current_blockers && (
              <div className="flex items-start text-sm text-orange-600">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span className="truncate">{project.current_blockers}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
              <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      ))}

      {filteredProjects.length === 0 && (
        <div className="col-span-full text-center py-12">
          <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-medium mb-2">No projects found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
        </div>
      )}
    </div>
  )

  if (!hasPermission("integrations")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view integrations.</p>
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
            <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Projects</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchAllData}>Retry</Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const statuses = [
    "Not Started",
    "API Kit Requested",
    "Credentials Pending",
    "Development",
    "Internal Testing",
    "UAT in Progress",
    "Production Ready",
    "Go Live",
    "On Hold",
  ]

  const priorities = ["High", "Medium", "Low"]

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Integration Projects</h1>
              <p className="text-gray-600 mt-2">Manage insurance integration workflows and timelines</p>
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
                  <TableIcon className="h-4 w-4 mr-1" />
                  Table
                </Button>
                <Button
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="h-8"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Cards
                </Button>
              </div>

              {/* CSV Download Button */}
              <Button variant="outline" onClick={handleDownloadCSV} disabled={filteredProjects.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV ({filteredProjects.length})
              </Button>

              {hasPermission("integrations") &&
                ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "") && (
                  <Button onClick={() => openModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Integration
                  </Button>
                )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search projects..."
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
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "") && (
                <div>
                  <Label htmlFor="company-filter">Company</Label>
                  <select
                    id="company-filter"
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Companies</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label htmlFor="priority-filter">Priority</Label>
                <select
                  id="priority-filter"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Priorities</option>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("")
                    setCompanyFilter("")
                    setPriorityFilter("")
                    setSearchTerm("")
                  }}
                  className="w-full"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          {viewMode === "table" ? <TableView /> : <CardView />}
        </div>
      </div>

      {/* Add/Edit Modal - Keep existing modal code unchanged */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">
                  {editingProject ? "Edit Integration Project" : "New Integration Project"}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Details */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Project Details</h4>

                  {["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "") && (
                    <div>
                      <Label htmlFor="company_id">Company</Label>
                      <select
                        id="company_id"
                        value={formData.company_id || ""}
                        onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select Company</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="product_id">Product Platform</Label>
                    <select
                      id="product_id"
                      value={formData.product_id || ""}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select Product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.display_name || product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="sub_product_id">Insurance Product</Label>
                    <select
                      id="sub_product_id"
                      value={formData.sub_product_id || ""}
                      onChange={(e) => setFormData({ ...formData, sub_product_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select Insurance Product</option>
                      {subProducts.map((subProduct) => (
                        <option key={subProduct.id} value={subProduct.id}>
                          {subProduct.display_name || subProduct.name} ({subProduct.category})
                        </option>
                      ))}
                    </select>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <select
                        id="status"
                        value={formData.status || "Not Started"}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {statuses.map((status) => (
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
                        {priorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="go_live_planned_date">Target Go-Live Date</Label>
                      <Input
                        id="go_live_planned_date"
                        type="date"
                        value={formData.go_live_planned_date || ""}
                        onChange={(e) => setFormData({ ...formData, go_live_planned_date: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="dev_estimated_hours">Estimated Dev Hours</Label>
                      <Input
                        id="dev_estimated_hours"
                        type="number"
                        value={formData.dev_estimated_hours || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, dev_estimated_hours: Number.parseInt(e.target.value) })
                        }
                        placeholder="40"
                      />
                    </div>
                  </div>
                </div>

                {/* Workflow Tracking */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Workflow Tracking</h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          id="api_kit_received"
                          type="checkbox"
                          checked={formData.api_kit_received || false}
                          onChange={(e) => setFormData({ ...formData, api_kit_received: e.target.checked })}
                          className="mr-3"
                        />
                        <Label htmlFor="api_kit_received">API Kit Received</Label>
                      </div>
                      <Input
                        type="date"
                        value={formData.api_kit_received_date || ""}
                        onChange={(e) => setFormData({ ...formData, api_kit_received_date: e.target.value })}
                        className="w-40"
                        disabled={!formData.api_kit_received}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          id="creds_verified"
                          type="checkbox"
                          checked={formData.creds_verified || false}
                          onChange={(e) => setFormData({ ...formData, creds_verified: e.target.checked })}
                          className="mr-3"
                        />
                        <Label htmlFor="creds_verified">Credentials Verified</Label>
                      </div>
                      <Input
                        type="date"
                        value={formData.creds_verification_date || ""}
                        onChange={(e) => setFormData({ ...formData, creds_verification_date: e.target.value })}
                        className="w-40"
                        disabled={!formData.creds_verified}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dev_start_date">Dev Start Date</Label>
                        <Input
                          id="dev_start_date"
                          type="date"
                          value={formData.dev_start_date || ""}
                          onChange={(e) => setFormData({ ...formData, dev_start_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="dev_end_date">Dev End Date</Label>
                        <Input
                          id="dev_end_date"
                          type="date"
                          value={formData.dev_end_date || ""}
                          onChange={(e) => setFormData({ ...formData, dev_end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="internal_testing_start_date">Internal Testing Start</Label>
                        <Input
                          id="internal_testing_start_date"
                          type="date"
                          value={formData.internal_testing_start_date || ""}
                          onChange={(e) => setFormData({ ...formData, internal_testing_start_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="internal_testing_end_date">Internal Testing End</Label>
                        <Input
                          id="internal_testing_end_date"
                          type="date"
                          value={formData.internal_testing_end_date || ""}
                          onChange={(e) => setFormData({ ...formData, internal_testing_end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          id="insurer_uat_creds_received"
                          type="checkbox"
                          checked={formData.insurer_uat_creds_received || false}
                          onChange={(e) => setFormData({ ...formData, insurer_uat_creds_received: e.target.checked })}
                          className="mr-3"
                        />
                        <Label htmlFor="insurer_uat_creds_received">UAT Creds Received</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="insurer_uat_start_date">UAT Start Date</Label>
                        <Input
                          id="insurer_uat_start_date"
                          type="date"
                          value={formData.insurer_uat_start_date || ""}
                          onChange={(e) => setFormData({ ...formData, insurer_uat_start_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="insurer_uat_end_date">UAT End Date</Label>
                        <Input
                          id="insurer_uat_end_date"
                          type="date"
                          value={formData.insurer_uat_end_date || ""}
                          onChange={(e) => setFormData({ ...formData, insurer_uat_end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          id="prod_creds_received"
                          type="checkbox"
                          checked={formData.prod_creds_received || false}
                          onChange={(e) => setFormData({ ...formData, prod_creds_received: e.target.checked })}
                          className="mr-3"
                        />
                        <Label htmlFor="prod_creds_received">Prod Creds Received</Label>
                      </div>
                      <Input
                        type="date"
                        value={formData.prod_cred_receipt_date || ""}
                        onChange={(e) => setFormData({ ...formData, prod_cred_receipt_date: e.target.value })}
                        className="w-40"
                        disabled={!formData.prod_creds_received}
                      />
                    </div>

                    <div>
                      <Label htmlFor="go_live_date">Go Live Date</Label>
                      <Input
                        id="go_live_date"
                        type="date"
                        value={formData.go_live_date || ""}
                        onChange={(e) => setFormData({ ...formData, go_live_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-medium text-gray-900">Notes & Blockers</h4>

                  <div>
                    <Label htmlFor="current_blockers">Current Blockers</Label>
                    <Textarea
                      id="current_blockers"
                      value={formData.current_blockers || ""}
                      onChange={(e) => setFormData({ ...formData, current_blockers: e.target.value })}
                      placeholder="Describe any current blockers or issues..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="technical_notes">Technical Notes</Label>
                      <Textarea
                        id="technical_notes"
                        value={formData.technical_notes || ""}
                        onChange={(e) => setFormData({ ...formData, technical_notes: e.target.value })}
                        placeholder="Technical implementation notes..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="business_notes">Business Notes</Label>
                      <Textarea
                        id="business_notes"
                        value={formData.business_notes || ""}
                        onChange={(e) => setFormData({ ...formData, business_notes: e.target.value })}
                        placeholder="Business requirements and notes..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingProject ? "Update" : "Create"} Project
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Detail Modal - Keep existing modal code unchanged */}
      {showDetailModal && viewingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-semibold">
                    {viewingProject.sub_product_display_name || viewingProject.sub_product_name}
                  </h3>
                  <p className="text-gray-600">
                    {viewingProject.company_name} × {viewingProject.insurer_name}
                  </p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Project Overview */}
                <div className="lg:col-span-1">
                  <h4 className="font-medium text-gray-900 mb-4">Project Overview</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Status</span>
                      <div className="mt-1">
                        <Badge className={getStatusColor(viewingProject.status)} variant="secondary">
                          {viewingProject.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Priority</span>
                      <div className="mt-1">
                        <Badge className={getPriorityColor(viewingProject.priority)} variant="secondary">
                          {viewingProject.priority}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Progress</span>
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${getProjectProgress(viewingProject)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">{getProjectProgress(viewingProject)}% Complete</span>
                      </div>
                    </div>
                    {viewingProject.go_live_planned_date && (
                      <div>
                        <span className="text-sm text-gray-500">Target Go-Live</span>
                        <div className="text-sm text-gray-900">
                          {new Date(viewingProject.go_live_planned_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Workflow Timeline */}
                <div className="lg:col-span-2">
                  <h4 className="font-medium text-gray-900 mb-4">Workflow Timeline</h4>
                  <div className="space-y-4">
                    {[
                      {
                        name: "API Kit Received",
                        completed: viewingProject.api_kit_received,
                        date: viewingProject.api_kit_received_date,
                      },
                      {
                        name: "Credentials Verified",
                        completed: viewingProject.creds_verified,
                        date: viewingProject.creds_verification_date,
                      },
                      {
                        name: "Development",
                        completed: viewingProject.dev_start_date ? true : false,
                        date: viewingProject.dev_start_date,
                        endDate: viewingProject.dev_end_date,
                      },
                      {
                        name: "Internal Testing",
                        completed: viewingProject.internal_testing_start_date ? true : false,
                        date: viewingProject.internal_testing_start_date,
                        endDate: viewingProject.internal_testing_end_date,
                      },
                      {
                        name: "UAT Credentials",
                        completed: viewingProject.insurer_uat_creds_received,
                        date: viewingProject.insurer_uat_start_date,
                        endDate: viewingProject.insurer_uat_end_date,
                      },
                      {
                        name: "Production Credentials",
                        completed: viewingProject.prod_creds_received,
                        date: viewingProject.prod_cred_receipt_date,
                      },
                      {
                        name: "Go Live",
                        completed: viewingProject.go_live_date ? true : false,
                        date: viewingProject.go_live_date,
                      },
                    ].map((stage, index) => (
                      <div key={stage.name} className="flex items-center">
                        <div className="flex items-center">
                          {stage.completed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                          <span className={`ml-3 text-sm ${stage.completed ? "text-gray-900" : "text-gray-500"}`}>
                            {stage.name}
                          </span>
                        </div>
                        <div className="ml-auto text-sm text-gray-600">
                          {stage.date && (
                            <span>
                              {new Date(stage.date).toLocaleDateString()}
                              {stage.endDate && ` - ${new Date(stage.endDate).toLocaleDateString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              {(viewingProject.current_blockers || viewingProject.technical_notes || viewingProject.business_notes) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4">Notes</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {viewingProject.current_blockers && (
                      <div>
                        <h5 className="text-sm font-medium text-red-600 mb-2">Current Blockers</h5>
                        <p className="text-sm text-gray-700 bg-red-50 p-3 rounded">{viewingProject.current_blockers}</p>
                      </div>
                    )}
                    {viewingProject.technical_notes && (
                      <div>
                        <h5 className="text-sm font-medium text-blue-600 mb-2">Technical Notes</h5>
                        <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">{viewingProject.technical_notes}</p>
                      </div>
                    )}
                    {viewingProject.business_notes && (
                      <div>
                        <h5 className="text-sm font-medium text-green-600 mb-2">Business Notes</h5>
                        <p className="text-sm text-gray-700 bg-green-50 p-3 rounded">{viewingProject.business_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
