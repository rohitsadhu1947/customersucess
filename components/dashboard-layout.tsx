"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  GitBranch,
  Heart,
  Ticket,
  BarChart3,
  Layers,
} from "lucide-react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, hasPermission } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<{ id: number; title: string; message: string; type: string; entity_type: string; entity_id: string; is_read: boolean; created_at: string }[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{
    companies: { id: string; name: string }[]
    issues: { id: string; title: string }[]
    integrations: { id: string; company_name: string; insurer_name: string }[]
    tickets?: { id: string; ticket_number: string; subject: string; status: string }[]
  } | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // Notifications table may not exist yet
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 60000) // Poll every 60s
      return () => clearInterval(interval)
    }
  }, [user, fetchNotifications])

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      // Silently fail
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults(null)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    if (value.length < 2) {
      setSearchResults(null)
      return
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } catch {
        setSearchResults(null)
      }
    }, 300)
  }, [])

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
    { name: "Dashboard", href: "/", icon: Home, permission: "dashboard" },
    { name: "Integrations", href: "/integrations", icon: Package, permission: "integrations" },
    { name: "Pipeline", href: "/pipeline", icon: GitBranch, permission: "integrations" },
    { name: "Insurer Plans", href: "/insurer-plans", icon: Layers, permission: "integrations" },
    { name: "Issues", href: "/issues", icon: MessageSquare, permission: "issues" },
    { name: "Tickets", href: "/tickets", icon: Ticket, permission: "tickets" },
    { name: "Ticket Dashboard", href: "/ticket-dashboard", icon: BarChart3, permission: "tickets" },
    { name: "Reports", href: "/reports", icon: BarChart, permission: "reports" },
    { name: "Companies", href: "/companies", icon: Building, permission: "companies" },
    { name: "Company Health", href: "/company-health", icon: Heart, permission: "companies" },
    { name: "Users", href: "/users", icon: Users, permission: "users" },
    { name: "Master Data", href: "/master-data", icon: Settings, permission: "master-data" },
  ].filter((item) => hasPermission(item.permission))

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  const currentPage = navigation.find((item) => isActive(item.href))?.name || "Dashboard"

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
                  isActive(item.href)
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
              <Link href="/" className="text-gray-400 hover:text-gray-600">
                <Home className="w-4 h-4" />
              </Link>
              {currentPage !== "Dashboard" && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="text-sm font-medium text-gray-900">{currentPage}</span>
                </>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchResults && (
                  <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-96 overflow-y-auto">
                    {searchResults.companies.length === 0 &&
                      searchResults.issues.length === 0 &&
                      searchResults.integrations.length === 0 &&
                      (!searchResults.tickets || searchResults.tickets.length === 0) ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
                    ) : (
                      <>
                        {searchResults.companies.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Companies
                            </div>
                            {searchResults.companies.map((company) => (
                              <button
                                key={company.id}
                                onClick={() => {
                                  router.push(`/companies/${company.id}`)
                                  setSearchResults(null)
                                  setSearchQuery("")
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Building className="w-4 h-4 mr-2 text-gray-400" />
                                {company.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.issues.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Issues
                            </div>
                            {searchResults.issues.map((issue) => (
                              <button
                                key={issue.id}
                                onClick={() => {
                                  router.push(`/issues/${issue.id}`)
                                  setSearchResults(null)
                                  setSearchQuery("")
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <MessageSquare className="w-4 h-4 mr-2 text-gray-400" />
                                {issue.title}
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.integrations.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Integrations
                            </div>
                            {searchResults.integrations.map((integration) => (
                              <button
                                key={integration.id}
                                onClick={() => {
                                  router.push(`/integrations/${integration.id}`)
                                  setSearchResults(null)
                                  setSearchQuery("")
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Package className="w-4 h-4 mr-2 text-gray-400" />
                                {integration.company_name} &mdash; {integration.insurer_name}
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.tickets && searchResults.tickets.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Tickets
                            </div>
                            {searchResults.tickets.map((ticket) => (
                              <button
                                key={ticket.id}
                                onClick={() => {
                                  router.push(`/tickets/${ticket.id}`)
                                  setSearchResults(null)
                                  setSearchQuery("")
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                              >
                                <Ticket className="w-4 h-4 mr-2 text-gray-400" />
                                <span className="font-mono text-xs text-gray-500 mr-2">{ticket.ticket_number}</span>
                                {ticket.subject}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">Notifications</p>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-700">
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 flex flex-col items-center text-gray-400">
                        <Bell className="w-6 h-6 mb-2" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map((notif) => (
                          <button
                            key={notif.id}
                            onClick={() => {
                              if (notif.entity_type && notif.entity_id) {
                                const routes: Record<string, string> = {
                                  issue: `/issues/${notif.entity_id}`,
                                  company: `/companies/${notif.entity_id}`,
                                  ticket: `/tickets/${notif.entity_id}`,
                                  integration: `/integrations/${notif.entity_id}`,
                                }
                                const route = routes[notif.entity_type]
                                if (route) router.push(route)
                              }
                              setNotificationsOpen(false)
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                              !notif.is_read ? "bg-blue-50" : ""
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                            {notif.message && <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>}
                            <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

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
