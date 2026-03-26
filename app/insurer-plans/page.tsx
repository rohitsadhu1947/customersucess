"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Calendar,
  Layers,
  Filter,
} from "lucide-react"

interface InsurerPlan {
  id: string
  insurer_id: string
  product_id: string
  sub_product_id: string | null
  status: string
  planned_date: string | null
  development_start_date: string | null
  uat_start_date: string | null
  go_live_date: string | null
  notes: string | null
  api_version: string | null
  created_by_name: string
  created_at: string
  updated_at: string
  insurer_name: string
  insurer_short_name: string
  insurer_code: string
  product_name: string
  product_display_name: string
  product_code: string
  sub_product_name: string | null
  sub_product_display_name: string | null
  sub_product_code: string | null
}

interface Insurer {
  id: string
  name: string
  short_name: string
  code: string
}

interface Product {
  id: string
  name: string
  display_name: string
  code: string
}

interface SubProduct {
  id: string
  product_id: string
  name: string
  display_name: string
  code: string
}

const PLAN_STATUSES = ["Planned", "In Development", "UAT", "Live", "Deprecated"]

const STATUS_COLORS: Record<string, string> = {
  Planned: "bg-gray-100 text-gray-800",
  "In Development": "bg-blue-100 text-blue-800",
  UAT: "bg-orange-100 text-orange-800",
  Live: "bg-green-100 text-green-800",
  Deprecated: "bg-red-100 text-red-800",
}

export default function InsurerPlansPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<InsurerPlan[]>([])
  const [insurers, setInsurers] = useState<Insurer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [subProducts, setSubProducts] = useState<SubProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterInsurer, setFilterInsurer] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<InsurerPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    insurer_id: "",
    product_id: "",
    sub_product_id: "",
    status: "Planned",
    planned_date: "",
    development_start_date: "",
    uat_start_date: "",
    go_live_date: "",
    notes: "",
    api_version: "",
  })

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/insurer-plans")
      if (res.ok) setPlans(await res.json())
    } catch (error) {
      console.error("Error fetching plans:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMasterData = useCallback(async () => {
    try {
      const [iRes, pRes, spRes] = await Promise.all([
        fetch("/api/master-data/insurers"),
        fetch("/api/master-data/products"),
        fetch("/api/master-data/sub-products"),
      ])
      if (iRes.ok) setInsurers(await iRes.json())
      if (pRes.ok) setProducts(await pRes.json())
      if (spRes.ok) setSubProducts(await spRes.json())
    } catch (error) {
      console.error("Error fetching master data:", error)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
    fetchMasterData()
  }, [fetchPlans, fetchMasterData])

  const openModal = (plan?: InsurerPlan) => {
    if (plan) {
      setEditingPlan(plan)
      setFormData({
        insurer_id: plan.insurer_id,
        product_id: plan.product_id,
        sub_product_id: plan.sub_product_id || "",
        status: plan.status,
        planned_date: plan.planned_date?.split("T")[0] || "",
        development_start_date: plan.development_start_date?.split("T")[0] || "",
        uat_start_date: plan.uat_start_date?.split("T")[0] || "",
        go_live_date: plan.go_live_date?.split("T")[0] || "",
        notes: plan.notes || "",
        api_version: plan.api_version || "",
      })
    } else {
      setEditingPlan(null)
      setFormData({
        insurer_id: "",
        product_id: "",
        sub_product_id: "",
        status: "Planned",
        planned_date: "",
        development_start_date: "",
        uat_start_date: "",
        go_live_date: "",
        notes: "",
        api_version: "",
      })
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = editingPlan ? `/api/insurer-plans/${editingPlan.id}` : "/api/insurer-plans"
      const method = editingPlan ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowModal(false)
        fetchPlans()
      } else {
        const err = await res.json()
        alert(err.error || "Failed to save")
      }
    } catch (error) {
      console.error("Save error:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this insurer plan?")) return
    try {
      const res = await fetch(`/api/insurer-plans/${id}`, { method: "DELETE" })
      if (res.ok) fetchPlans()
    } catch (error) {
      console.error("Delete error:", error)
    }
  }

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      !searchTerm ||
      plan.insurer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.sub_product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesInsurer = !filterInsurer || plan.insurer_id === filterInsurer
    const matchesStatus = !filterStatus || plan.status === filterStatus
    return matchesSearch && matchesInsurer && matchesStatus
  })

  // Group plans by insurer for a nice grouped view
  const groupedByInsurer = filteredPlans.reduce(
    (acc, plan) => {
      const key = plan.insurer_short_name || plan.insurer_name
      if (!acc[key]) acc[key] = []
      acc[key].push(plan)
      return acc
    },
    {} as Record<string, InsurerPlan[]>,
  )

  const filteredSubProducts = subProducts.filter(
    (sp) => !formData.product_id || sp.product_id === formData.product_id,
  )

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—")

  const canEdit = ["Admin", "Ensuredit", "Ensuredit Client Lead"].includes(user?.role || "")

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insurer Integration Plans</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track which plans are integrated for each insurer with their respective dates
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Plan
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search insurer, product, plan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filterInsurer}
            onChange={(e) => setFilterInsurer(e.target.value)}
          >
            <option value="">All Insurers</option>
            {insurers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.short_name || i.name}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {(searchTerm || filterInsurer || filterStatus) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setFilterInsurer("")
                setFilterStatus("")
              }}
            >
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {PLAN_STATUSES.map((status) => {
            const count = plans.filter((p) => p.status === status).length
            return (
              <div key={status} className="bg-white rounded-lg shadow-sm border p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-500 mt-1">{status}</div>
              </div>
            )
          })}
        </div>

        {/* Table grouped by insurer */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : Object.keys(groupedByInsurer).length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No insurer plans found</h3>
            <p className="text-sm">Add integration plans to track which plans are integrated per insurer.</p>
          </div>
        ) : (
          Object.entries(groupedByInsurer).map(([insurerName, insurerPlans]) => (
            <div key={insurerName} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <h2 className="text-lg font-semibold text-gray-900">{insurerName}</h2>
                <p className="text-xs text-gray-500">{insurerPlans.length} plan(s)</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Plan (Sub-Product)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Planned Date</TableHead>
                    <TableHead>Dev Start</TableHead>
                    <TableHead>UAT Start</TableHead>
                    <TableHead>Go Live</TableHead>
                    <TableHead>API Version</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insurerPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">
                        {plan.product_display_name || plan.product_name}
                      </TableCell>
                      <TableCell>
                        <span className="text-blue-700 font-medium">
                          {plan.sub_product_display_name || plan.sub_product_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[plan.status] || "bg-gray-100"}>{plan.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(plan.planned_date)}</TableCell>
                      <TableCell className="text-sm">{formatDate(plan.development_start_date)}</TableCell>
                      <TableCell className="text-sm">{formatDate(plan.uat_start_date)}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {plan.go_live_date ? (
                          <span className="text-green-700">{formatDate(plan.go_live_date)}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{plan.api_version || "—"}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openModal(plan)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {user?.role === "Admin" && (
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(plan.id)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingPlan ? "Edit Insurer Plan" : "Add Insurer Plan"}
                </h2>
                <button onClick={() => setShowModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Insurer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurer *</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={formData.insurer_id}
                    onChange={(e) => setFormData({ ...formData, insurer_id: e.target.value })}
                    disabled={!!editingPlan}
                  >
                    <option value="">Select Insurer</option>
                    {insurers.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.short_name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Product */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={formData.product_id}
                    onChange={(e) =>
                      setFormData({ ...formData, product_id: e.target.value, sub_product_id: "" })
                    }
                    disabled={!!editingPlan}
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub-Product / Plan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan (Sub-Product)</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={formData.sub_product_id}
                    onChange={(e) => setFormData({ ...formData, sub_product_id: e.target.value })}
                    disabled={!!editingPlan}
                  >
                    <option value="">All Plans / General</option>
                    {filteredSubProducts.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.display_name || sp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {PLAN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Planned Date</label>
                    <Input
                      type="date"
                      value={formData.planned_date}
                      onChange={(e) => setFormData({ ...formData, planned_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dev Start Date</label>
                    <Input
                      type="date"
                      value={formData.development_start_date}
                      onChange={(e) => setFormData({ ...formData, development_start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">UAT Start Date</label>
                    <Input
                      type="date"
                      value={formData.uat_start_date}
                      onChange={(e) => setFormData({ ...formData, uat_start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Go Live Date</label>
                    <Input
                      type="date"
                      value={formData.go_live_date}
                      onChange={(e) => setFormData({ ...formData, go_live_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* API Version */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Version</label>
                  <Input
                    placeholder="e.g. v2.1"
                    value={formData.api_version}
                    onChange={(e) => setFormData({ ...formData, api_version: e.target.value })}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Integration notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !formData.insurer_id || !formData.product_id}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? "Saving..." : editingPlan ? "Update Plan" : "Add Plan"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
