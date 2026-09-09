import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div id="admin-admin-layout" className="flex flex-col md:flex-row min-h-screen bg-[#FDF8F2]">
        <div className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-[#1C1008] px-4 py-3 text-[#FDF8F2] border-b border-[#B8860B]/40">
          <span className="font-serif text-lg font-bold tracking-[0.1em]">KALARANG</span>
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-[#B8860B]/40 text-[#B8860B]"
            aria-label={sidebarOpen ? 'Close admin navigation' : 'Open admin navigation'}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block md:h-screen md:sticky md:top-0`}>
          <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        {/* Workspace section panel */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto w-full md:max-w-none">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>

      </div>
    </ProtectedRoute>
  );
}
