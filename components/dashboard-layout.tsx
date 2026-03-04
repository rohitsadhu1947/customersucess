"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import {
  Home,
  Package,
  Building,
  Users,
  Settings,
  BarChart,
  Menu,
  ChevronDown,
  LogOut,
  Bell,
  Search,
  MessageSquare,
} from "lucide-react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, hasPermission } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  if (!user) {
    return null
  }

  const userInfo = {
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.companyName || "No Company",
    avatar: user.name
      .split(" ")
      .map((n) => n[0])
      .join(""),
  }

  const navigation = [
    { name: "Dashboard", href: "/", icon: Home, current: true, permission: "dashboard" },
    { name: "Integrations", href: "/integrations", icon: Package, current: false, permission: "integrations" },
    { name: "Project Status", href: "/issues", icon: MessageSquare, current: false, permission: "issues" },
    { name: "Reports", href: "/reports", icon: BarChart, current: false, permission: "reports" },
    { name: "Companies", href: "/companies", icon: Building, current: false, permission: "companies" },
    { name: "Users", href: "/users", icon: Users, current: false, permission: "users" },
    { name: "Master Data", href: "/master-data", icon: Settings, current: false, permission: "master-data" },
  ].filter((item) => hasPermission(item.permission))

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      Admin: "bg-red-100 text-red-800",
      Ensuredit: "bg-blue-100 text-blue-800",
      "Ensuredit Client Lead": "bg-blue-100 text-blue-800",
      Customer: "bg-green-100 text-green-800",
      "Customer View Only": "bg-gray-100 text-gray-800",
    }
    return colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  const handleSignOut = async () => {
    await logout()
  }

  return (
    <div className="h-screen bg-gray-50 flex">
      <div className={`${sidebarOpen ? "w-64" : "w-16"} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {sidebarOpen && (
            <div className="flex items-center">
              <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Ensuredit</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  item.current
                    ? "bg-blue-50 text-blue-700 border-r-4 border-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-5 h-5 ${sidebarOpen ? "mr-3" : ""}`} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-sm font-medium">{userInfo.avatar}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userInfo.name}</p>
                <p className="text-xs text-gray-500 truncate">{userInfo.company}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-2">
              <Home className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">/</span>
              <span className="text-sm font-medium text-gray-900">Dashboard</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{userInfo.avatar}</span>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900">{userInfo.name}</p>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(userInfo.role)}`}
                    >
                      {userInfo.role}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{userInfo.name}</p>
                      <p className="text-xs text-gray-500">{userInfo.email}</p>
                    </div>
                    <a href="#" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      <Settings className="w-4 h-4 mr-3" />
                      Profile Settings
                    </a>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
