"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2, Building2, Package, Settings, Save, X, Globe, Mail } from "lucide-react"

interface Insurer {
  id: string
  name: string
  short_name: string
  code: string
  insurer_type: string
  license_type: string
  primary_contact_name: string
  primary_contact_email: string
  primary_contact_phone: string
  technical_contact_name: string
  technical_contact_email: string
  technical_contact_phone: string
  website_url: string
  api_documentation_url: string
  developer_portal_url: string
  supports_api: boolean
  api_version: string
  authentication_method: string
  status: string
  onboarding_status: string
  is_preferred_partner: boolean
  partnership_tier: string
  market_share_percentage: number
  customer_rating: number
  claim_settlement_ratio: number
  created_at: string
}

interface Product {
  id: string
  name: string
  code: string
  display_name: string
  description: string
  product_type: string
  target_market: string
  api_base_url: string
  documentation_url: string
  sandbox_url: string
  pricing_model: string
  base_price: number
  currency: string
  is_active: boolean
  launch_date: string
  sub_products: SubProduct[]
}

interface SubProduct {
  id: string
  product_id: string
  name: string
  code: string
  display_name: string
  description: string
  category: string
  sub_category: string
  min_premium_amount: number
  max_premium_amount: number
  complexity_score: number
  estimated_dev_hours: number
  requires_custom_integration: boolean
  is_active: boolean
  product_name: string
  product_code: string
}

export default function MasterDataPage() {
  const { user, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState("insurers")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Initialize as empty arrays
  const [insurers, setInsurers] = useState<Insurer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [subProducts, setSubProducts] = useState<SubProduct[]>([])

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [modalType, setModalType] = useState("")

  // Form data
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (user && hasPermission("master-data")) {
      fetchAllData()
    }
  }, [user])

  const fetchAllData = async () => {
    try {
      setError("")

      let insurersData: Insurer[] = []
      let productsData: Product[] = []
      let subProductsData: SubProduct[] = []

      try {
        const insurersRes = await fetch("/api/master-data/insurers")
        if (insurersRes.ok) {
          const data = await insurersRes.json()
          insurersData = Array.isArray(data) ? data : []
        } else {
          console.error("Failed to fetch insurers:", await insurersRes.text())
        }
      } catch (err) {
        console.error("Error fetching insurers:", err)
      }

      try {
        const productsRes = await fetch("/api/master-data/products")
        if (productsRes.ok) {
          const data = await productsRes.json()
          productsData = Array.isArray(data) ? data : []
        } else {
          console.error("Failed to fetch products:", await productsRes.text())
        }
      } catch (err) {
        console.error("Error fetching products:", err)
      }

      try {
        const subProductsRes = await fetch("/api/master-data/sub-products")
        if (subProductsRes.ok) {
          const data = await subProductsRes.json()
          subProductsData = Array.isArray(data) ? data : []
        } else {
          console.error("Failed to fetch sub-products:", await subProductsRes.text())
        }
      } catch (err) {
        console.error("Error fetching sub-products:", err)
      }

      setInsurers(insurersData)
      setProducts(productsData)
      setSubProducts(subProductsData)
    } catch (error) {
      console.error("Error fetching master data:", error)
      setError("Failed to load master data. Please check if the database tables exist.")
    } finally {
      setLoading(false)
    }
  }

  const openModal = (type: string, item: any = null) => {
    setModalType(type)
    setEditingItem(item)
    setShowModal(true)

    if (item) {
      setFormData({ ...item })
    } else {
      switch (type) {
        case "insurer":
          setFormData({
            name: "",
            short_name: "",
            code: "",
            insurer_type: "General",
            license_type: "Composite",
            primary_contact_name: "",
            primary_contact_email: "",
            primary_contact_phone: "",
            website_url: "",
            api_documentation_url: "",
            supports_api: false,
            status: "Active",
            onboarding_status: "Not Started",
            is_preferred_partner: false,
            partnership_tier: "Standard",
          })
          break
        case "product":
          setFormData({
            name: "",
            code: "",
            display_name: "",
            description: "",
            product_type: "Platform",
            target_market: "Insurance",
            currency: "INR",
            is_active: true,
          })
          break
        case "sub-product":
          setFormData({
            product_id: "",
            name: "",
            code: "",
            display_name: "",
            description: "",
            category: "",
            sub_category: "",
            complexity_score: 1,
            requires_custom_integration: false,
            is_active: true,
            sort_order: 0,
          })
          break
      }
    }
  }

  const handleSave = async () => {
    try {
      const method = editingItem ? "PUT" : "POST"
      let endpoint = ""

      switch (modalType) {
        case "insurer":
          endpoint = "/api/master-data/insurers"
          break
        case "product":
          endpoint = "/api/master-data/products"
          break
        case "sub-product":
          endpoint = "/api/master-data/sub-products"
          break
      }

      const response = await fetch(endpoint, {
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
      alert("Error saving data")
    }
  }

  const handleDelete = async (type: string, id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return

    try {
      let endpoint = ""
      switch (type) {
        case "insurer":
          endpoint = `/api/master-data/insurers?id=${id}`
          break
        case "product":
          endpoint = `/api/master-data/products?id=${id}`
          break
        case "sub-product":
          endpoint = `/api/master-data/sub-products?id=${id}`
          break
      }

      const response = await fetch(endpoint, { method: "DELETE" })

      if (response.ok) {
        fetchAllData()
      } else {
        const errorText = await response.text()
        alert(`Error deleting: ${errorText}`)
      }
    } catch (error) {
      console.error("Error deleting:", error)
      alert("Error deleting data")
    }
  }

  if (!hasPermission("master-data")) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view master data.</p>
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
            <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Data</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchAllData}>Retry</Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const tabs = [
    { id: "insurers", name: "Insurance Partners", icon: Building2 },
    { id: "products", name: "Ensuredit Products", icon: Package },
    { id: "sub-products", name: "Insurance Products", icon: Settings },
  ]

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Master Data Management</h1>
            <p className="text-gray-600 mt-2">Configure insurers, products, and integration settings</p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Insurers Tab */}
          {activeTab === "insurers" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Insurance Partners ({insurers.length})</h2>
                <Button onClick={() => openModal("insurer")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Insurer
                </Button>
              </div>

              {insurers.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Insurance Partners</h3>
                  <p className="text-gray-600 mb-4">Get started by adding your first insurance partner.</p>
                  <Button onClick={() => openModal("insurer")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Insurer
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {insurers.map((insurer) => (
                    <div key={insurer.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{insurer.name}</h3>
                          <p className="text-sm text-gray-600">
                            {insurer.short_name} • {insurer.code}
                          </p>
                          <div className="flex space-x-2 mt-2">
                            <Badge variant={insurer.status === "Active" ? "default" : "secondary"} className="text-xs">
                              {insurer.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {insurer.onboarding_status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openModal("insurer", insurer)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user?.role === "Admin" && (
                            <button
                              onClick={() => handleDelete("insurer", insurer.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        {insurer.primary_contact_name && (
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 text-gray-400 mr-2" />
                            <span>{insurer.primary_contact_name}</span>
                          </div>
                        )}
                        {insurer.primary_contact_email && (
                          <div className="flex items-center">
                            <span className="text-gray-600">{insurer.primary_contact_email}</span>
                          </div>
                        )}
                        {insurer.website_url && (
                          <div className="flex items-center">
                            <Globe className="w-4 h-4 text-gray-400 mr-2" />
                            <a
                              href={insurer.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Website
                            </a>
                          </div>
                        )}
                        {insurer.supports_api && (
                          <div className="flex items-center">
                            <Settings className="w-4 h-4 text-green-500 mr-2" />
                            <span className="text-green-600">API Supported</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Ensuredit Products ({products.length})</h2>
                <Button onClick={() => openModal("product")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>

              {products.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Products</h3>
                  <p className="text-gray-600 mb-4">Get started by adding your first Ensuredit product.</p>
                  <Button onClick={() => openModal("product")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {products.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{product.display_name || product.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {product.code} • {product.product_type}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openModal("product", product)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user?.role === "Admin" && (
                            <button
                              onClick={() => handleDelete("product", product.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Available Insurance Products</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {product.sub_products?.map((subProduct) => (
                            <Badge key={subProduct.id} variant="outline" className="justify-center text-xs">
                              {subProduct.display_name || subProduct.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Products Tab */}
          {activeTab === "sub-products" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Insurance Products ({subProducts.length})</h2>
                <Button onClick={() => openModal("sub-product")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Insurance Product
                </Button>
              </div>

              {subProducts.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Insurance Products</h3>
                  <p className="text-gray-600 mb-4">Get started by adding your first insurance product.</p>
                  <Button onClick={() => openModal("sub-product")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Insurance Product
                  </Button>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Platform
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Complexity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {subProducts.map((subProduct) => (
                        <tr key={subProduct.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {subProduct.display_name || subProduct.name}
                              </div>
                              <div className="text-sm text-gray-500">{subProduct.code}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {subProduct.product_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {subProduct.category}
                            {subProduct.sub_category && (
                              <div className="text-xs text-gray-500">{subProduct.sub_category}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="outline" className="text-xs">
                              Level {subProduct.complexity_score}
                            </Badge>
                            {subProduct.estimated_dev_hours && (
                              <div className="text-xs text-gray-500 mt-1">{subProduct.estimated_dev_hours}h est.</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={subProduct.is_active ? "default" : "secondary"} className="text-xs">
                              {subProduct.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openModal("sub-product", subProduct)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {user?.role === "Admin" && (
                              <button
                                onClick={() => handleDelete("sub-product", subProduct.id)}
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
          )}
        </div>
      </div>

      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">
                  {editingItem ? "Edit" : "Add"} {modalType.replace("-", " ")}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Common fields */}
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter name"
                  />
                </div>

                {/* Insurer specific fields */}
                {modalType === "insurer" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="short_name">Short Name</Label>
                        <Input
                          id="short_name"
                          value={formData.short_name || ""}
                          onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                          placeholder="ICICI"
                        />
                      </div>
                      <div>
                        <Label htmlFor="code">Code</Label>
                        <Input
                          id="code"
                          value={formData.code || ""}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          placeholder="ICICI_LOMBARD"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="insurer_type">Insurer Type</Label>
                        <select
                          id="insurer_type"
                          value={formData.insurer_type || "General"}
                          onChange={(e) => setFormData({ ...formData, insurer_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="General">General</option>
                          <option value="Life">Life</option>
                          <option value="Health">Health</option>
                          <option value="Reinsurance">Reinsurance</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="license_type">License Type</Label>
                        <select
                          id="license_type"
                          value={formData.license_type || "Composite"}
                          onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="Composite">Composite</option>
                          <option value="General">General Only</option>
                          <option value="Life">Life Only</option>
                          <option value="Health">Health Only</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="primary_contact_name">Primary Contact Name</Label>
                      <Input
                        id="primary_contact_name"
                        value={formData.primary_contact_name || ""}
                        onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                        placeholder="Contact person name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="primary_contact_email">Primary Contact Email</Label>
                      <Input
                        id="primary_contact_email"
                        type="email"
                        value={formData.primary_contact_email || ""}
                        onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                        placeholder="contact@insurer.com"
                      />
                    </div>

                    <div>
                      <Label htmlFor="website_url">Website URL</Label>
                      <Input
                        id="website_url"
                        type="url"
                        value={formData.website_url || ""}
                        onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                        placeholder="https://www.insurer.com"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        id="supports_api"
                        type="checkbox"
                        checked={formData.supports_api || false}
                        onChange={(e) => setFormData({ ...formData, supports_api: e.target.checked })}
                        className="mr-2"
                      />
                      <Label htmlFor="supports_api">Supports API</Label>
                    </div>
                  </>
                )}

                {/* Product specific fields */}
                {modalType === "product" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="code">Code</Label>
                        <Input
                          id="code"
                          value={formData.code || ""}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          placeholder="ICE"
                        />
                      </div>
                      <div>
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                          id="display_name"
                          value={formData.display_name || ""}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          placeholder="Insurance Customer Experience"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Product description"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="api_base_url">API Base URL</Label>
                      <Input
                        id="api_base_url"
                        type="url"
                        value={formData.api_base_url || ""}
                        onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                        placeholder="https://api.ensuredit.com/ice"
                      />
                    </div>
                  </>
                )}

                {/* Sub-Product specific fields */}
                {modalType === "sub-product" && (
                  <>
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="code">Code</Label>
                        <Input
                          id="code"
                          value={formData.code || ""}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          placeholder="ICE_MOTOR_2W"
                        />
                      </div>
                      <div>
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                          id="display_name"
                          value={formData.display_name || ""}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          placeholder="Two Wheeler Insurance"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          value={formData.category || ""}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          placeholder="Motor"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sub_category">Sub Category</Label>
                        <Input
                          id="sub_category"
                          value={formData.sub_category || ""}
                          onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                          placeholder="Two Wheeler"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Product description"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="complexity_score">Complexity Score (1-5)</Label>
                        <Input
                          id="complexity_score"
                          type="number"
                          min="1"
                          max="5"
                          value={formData.complexity_score || 1}
                          onChange={(e) =>
                            setFormData({ ...formData, complexity_score: Number.parseInt(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="estimated_dev_hours">Estimated Dev Hours</Label>
                        <Input
                          id="estimated_dev_hours"
                          type="number"
                          value={formData.estimated_dev_hours || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, estimated_dev_hours: Number.parseInt(e.target.value) })
                          }
                          placeholder="40"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        id="requires_custom_integration"
                        type="checkbox"
                        checked={formData.requires_custom_integration || false}
                        onChange={(e) => setFormData({ ...formData, requires_custom_integration: e.target.checked })}
                        className="mr-2"
                      />
                      <Label htmlFor="requires_custom_integration">Requires Custom Integration</Label>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
