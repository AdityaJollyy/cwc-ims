import { useState } from 'react'
import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../../store/AuthContext'
import Sidebar from './Sidebar'
import { FullPageLoader } from '../ui/Loader'

const AppLayout = () => {
  const { isLoading, isAuthenticated } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (isLoading) return <FullPageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden w-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/cwc-about.png" alt="CWC logo" className="w-7 h-7 rounded-lg object-cover" />
            <p className="text-sm font-bold text-slate-800">CWC Inventory</p>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AppLayout
