"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Edit2,
  Trash2,
  UsersIcon,
  Filter,
  Search,
  Save,
  X,
  Eye,
  EyeOff,
  Shield,
  Mail,
  Building2,
  Download,
} from "lucide-react"
import { exportUsers } from "@/lib/csv-export"

interface User {
  id: string
  name: string
  email: string
  role_type: string
  company_id: string
  company_name: string
  is_active: boolean
  email_verified: boolean
  two_factor_enabled: boolean
  last_login: string
  created_at: string
  updated_at: string
}

interface Company {
  id: string
  name: string
}

export default function UsersPage() {
  const { user, hasPermission } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filter states
  const [roleFilter, setRoleFilter] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<any>({})
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (user && hasPermission("users")) {
      fetchAllData()
    }
  }, [user])

  useEffect(() => {
    filterUsers()
  }, [users, roleFilter, companyFilter, statusFilter, searchTerm])

  const fetchAllData = async () => {
    try {
      setError("")

      const [usersRes, companiesRes] = await Promise.all([fetch("/api/users"), fetch("/api/companies")])

      const [usersData, companiesData] = await Promise.all([usersRes.json(), companiesRes.json()])

      setUsers(Array.isArray(usersData) ? usersData : [])
      setCompanies(Array.isArray(companiesData) ? companiesData : [])
    } catch (error) {
      console.error("Error fetching data:", error)
      setError("Failed to load users data.")
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = [...users]

    if (roleFilter) {
      filtered = filtered.filter((u) => u.role_type === roleFilter)
    }

    if (companyFilter) {
      filtered = filtered.filter((u) => u.company_id === companyFilter)
    }

    if (statusFilter) {
      if (statusFilter === "active") {
        filtered = filtered.filter((u) => u.is_active)
      } else if (statusFilter === "inactive") {
        filtered = filtered.filter((u) => !u.is_active)
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.company_name?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredUsers(filtered)
  }

  const openModal = (userData: User | null = null) => {
    setEditingUser(userData)
    setShowModal(true)

    if (userData) {
      setFormData({
        ...userData,
        password: "", // Don't pre-fill password
        // email_verified comes from DB as a timestamp string or null — convert to boolean
        email_verified: !!userData.email_verified,
        is_active: userData.is_active ?? true,
        two_factor_enabled: userData.two_factor_enabled ?? false,
      })
    } else {
      setFormData({
        name: "",
        email: "",
        password: "",
        role_type: "Customer",
        company_id: "",
        is_active: true,
        email_verified: false,
        two_factor_enabled: false,
      })
    }
  }

  const handleSave = async () => {
    try {
      const method = editingUser ? "PUT" : "POST"

      // Remove empty password field for updates and ensure booleans are proper booleans
      const submitData = {
        ...formData,
        is_active: Boolean(formData.is_active),
        email_verified: Boolean(formData.email_verified),
        two_factor_enabled: Boolean(formData.two_factor_enabled),
      }
      if (editingUser && !submitData.password) {
        delete submitData.password
      }

      const response = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
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
      alert("Error saving user")
    }
  }

  const handleDelete = async (id: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"?`)) return

    try {
      const response = await fetch(`/api/users?id=${id}`, {
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
      alert("Error deleting user")
    }
  }

  const handleDownloadCSV = () => {
    if (filteredUsers.length === 0) {
      alert("No data to export")
      return
    }

    exportUsers(filteredUsers)
  }

  const getRoleColor = (role: string) => {
    const colors = {
      Admin: "bg-red-100 text-red-800",
      Ensuredit: "bg-blue-100 text-blue-800",
      "Ensuredit Client Lead": "bg-blue-100 text-blue-800",
      Customer: "bg-green-100 text-green-800",
      "Customer View Only": "bg-gray-100 text-gray-800",
    }
    return colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  if (!hasPermission("users")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to manage users.</p>
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
            <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Users</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchAllData}>Retry</Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const roles = ["Admin", "Ensuredit", "Ensuredit Client Lead", "Customer", "Customer View Only"]

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-2">Manage user accounts and permissions</p>
            </div>

            <div className="flex items-center space-x-3">
              {/* CSV Download Button */}
              <Button variant="outline" onClick={handleDownloadCSV} disabled={filteredUsers.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV ({filteredUsers.length})
              </Button>

              {["Admin", "Ensuredit"].includes(user?.role || "") && (
                <Button onClick={() => openModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
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
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role-filter">Role</Label>
                <select
                  id="role-filter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Roles</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {["Admin", "Ensuredit"].includes(user?.role || "") && (
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
                <Label htmlFor="status-filter">Status</Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRoleFilter("")
                    setCompanyFilter("")
                    setStatusFilter("")
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

          {/* Users Table */}
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
              <p className="text-gray-600 mb-4">
                {users.length === 0 ? "No users have been created yet." : "No users match your current filters."}
              </p>
              {users.length === 0 && ["Admin", "Ensuredit"].includes(user?.role || "") && (
                <Button onClick={() => openModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First User
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Security
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((userData) => (
                    <tr key={userData.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{userData.name}</div>
                          <div className="text-sm text-gray-500">{userData.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getRoleColor(userData.role_type)} variant="secondary">
                          {userData.role_type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {userData.company_name ? (
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{userData.company_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No company</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={userData.is_active ? "default" : "secondary"} className="text-xs">
                          {userData.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-1">
                          {userData.email_verified && (
                            <Badge variant="outline" className="text-xs">
                              <Mail className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {userData.two_factor_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="w-3 h-3 mr-1" />
                              2FA
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {userData.last_login ? new Date(userData.last_login).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {["Admin", "Ensuredit"].includes(user?.role || "") && (
                          <button
                            onClick={() => openModal(userData)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {user?.role === "Admin" && userData.id !== user?.id && (
                          <button
                            onClick={() => handleDelete(userData.id, userData.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">{editingUser ? "Edit User" : "Add New User"}</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name || ""}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@company.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">
                    {editingUser ? "New Password (leave blank to keep current)" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password || ""}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role_type">Role</Label>
                    <select
                      id="role_type"
                      value={formData.role_type || "Customer"}
                      onChange={(e) => setFormData({ ...formData, role_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="company_id">Company</Label>
                    <select
                      id="company_id"
                      value={formData.company_id || ""}
                      onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">No Company (Ensuredit users)</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Account Settings</h4>

                  <div className="flex items-center">
                    <input
                      id="is_active"
                      type="checkbox"
                      checked={formData.is_active || false}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="mr-3"
                    />
                    <Label htmlFor="is_active">Active Account</Label>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="email_verified"
                      type="checkbox"
                      checked={formData.email_verified || false}
                      onChange={(e) => setFormData({ ...formData, email_verified: e.target.checked })}
                      className="mr-3"
                    />
                    <Label htmlFor="email_verified">Email Verified</Label>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="two_factor_enabled"
                      type="checkbox"
                      checked={formData.two_factor_enabled || false}
                      onChange={(e) => setFormData({ ...formData, two_factor_enabled: e.target.checked })}
                      className="mr-3"
                    />
                    <Label htmlFor="two_factor_enabled">Two-Factor Authentication</Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingUser ? "Update" : "Create"} User
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
