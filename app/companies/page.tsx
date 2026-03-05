"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Users, Calendar, Mail, Building2, Save, Edit2, Download, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { exportCompanies } from "@/lib/csv-export"

interface Company {
  id: string
  name: string
  status: string
  user_count: number
  active_user_count: number
  customer_since: string
  ensuredit_lead_name: string
  client_lead_name: string
  client_lead_email: string
  notes: string
  created_at: string
}

export default function CompaniesPage() {
  const { user, hasPermission } = useAuth()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    ensuredit_lead_name: "",
    client_lead_name: "",
    client_lead_email: "",
    customer_since: "",
    status: "Active",
    notes: "",
  })

  useEffect(() => {
    if (user && hasPermission("companies")) {
      fetchCompanies()
    }
  }, [user])

  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/companies")
      const data = await response.json()
      setCompanies(data)
    } catch (error) {
      console.error("Error fetching companies:", error)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (company: Company | null = null) => {
    setEditingCompany(company)
    setShowModal(true)

    if (company) {
      setFormData({
        name: company.name || "",
        ensuredit_lead_name: company.ensuredit_lead_name || "",
        client_lead_name: company.client_lead_name || "",
        client_lead_email: company.client_lead_email || "",
        customer_since: company.customer_since ? company.customer_since.split("T")[0] : "",
        status: company.status || "Active",
        notes: company.notes || "",
      })
    } else {
      setFormData({
        name: "",
        ensuredit_lead_name: "",
        client_lead_name: "",
        client_lead_email: "",
        customer_since: "",
        status: "Active",
        notes: "",
      })
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCompany(null)
  }

  const handleSave = async () => {
    try {
      const method = editingCompany ? "PUT" : "POST"
      const url = editingCompany ? `/api/companies?id=${editingCompany.id}` : "/api/companies"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        closeModal()
        fetchCompanies()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error("Error saving company:", error)
      alert("Error saving company")
    }
  }

  const handleDownloadCSV = () => {
    if (companies.length === 0) {
      alert("No data to export")
      return
    }

    exportCompanies(companies)
  }

  if (!hasPermission("companies")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view companies.</p>
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

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
              <p className="text-gray-600 mt-2">Manage company accounts and relationships</p>
            </div>

            <div className="flex items-center space-x-3">
              {/* CSV Download Button */}
              <Button variant="outline" onClick={handleDownloadCSV} disabled={companies.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV ({companies.length})
              </Button>

              {["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "") && (
                <Button onClick={() => openModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/companies/${company.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant={company.status === "Active" ? "default" : "secondary"} className="text-xs">
                      {company.status}
                    </Badge>
                    {["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "") && (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openModal(company) }} className="h-8 w-8 p-0">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>
                      {company.user_count || 0} users ({company.active_user_count || 0} active)
                    </span>
                  </div>

                  {company.customer_since && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Customer since {new Date(company.customer_since).toLocaleDateString()}</span>
                    </div>
                  )}

                  {company.ensuredit_lead_name && (
                    <div className="text-sm">
                      <p className="font-medium text-gray-700">EnsuredIt Lead:</p>
                      <p className="text-gray-600">{company.ensuredit_lead_name}</p>
                    </div>
                  )}

                  {company.client_lead_name && (
                    <div className="text-sm">
                      <p className="font-medium text-gray-700">Client Lead:</p>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">{company.client_lead_name}</span>
                        {company.client_lead_email && (
                          <>
                            <Mail className="h-3 w-3 text-gray-400 ml-1" />
                            <span className="text-gray-500 text-xs">{company.client_lead_email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {company.notes && (
                    <div className="text-sm">
                      <p className="font-medium text-gray-700">Notes:</p>
                      <p className="text-gray-600 text-xs line-clamp-2">{company.notes}</p>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 pt-2 border-t">
                    Created {new Date(company.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {companies.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Building2 className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No companies yet</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first company.</p>
              {["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "") && (
                <Button onClick={() => openModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Dialog open={showModal} onOpenChange={closeModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCompany ? "Edit Company" : "Add New Company"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Prospect">Prospect</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="customer_since">Customer Since</Label>
                <Input
                  id="customer_since"
                  type="date"
                  value={formData.customer_since}
                  onChange={(e) => setFormData({ ...formData, customer_since: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ensuredit_lead_name">EnsuredIt Lead</Label>
                  <Input
                    id="ensuredit_lead_name"
                    value={formData.ensuredit_lead_name}
                    onChange={(e) => setFormData({ ...formData, ensuredit_lead_name: e.target.value })}
                    placeholder="EnsuredIt team lead"
                  />
                </div>
                <div>
                  <Label htmlFor="client_lead_name">Client Lead Name</Label>
                  <Input
                    id="client_lead_name"
                    value={formData.client_lead_name}
                    onChange={(e) => setFormData({ ...formData, client_lead_name: e.target.value })}
                    placeholder="Client contact name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="client_lead_email">Client Lead Email</Label>
                <Input
                  id="client_lead_email"
                  type="email"
                  value={formData.client_lead_email}
                  onChange={(e) => setFormData({ ...formData, client_lead_email: e.target.value })}
                  placeholder="client@company.com"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingCompany ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  )
}
