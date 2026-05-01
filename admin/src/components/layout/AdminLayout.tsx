import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const AdminLayout: React.FC = () => (
  <div className="flex h-screen overflow-hidden">
    <Sidebar />
    <main className="flex-1 overflow-y-auto bg-[var(--bg-app)]">
      <div className="mx-auto max-w-5xl px-10 py-10">
        <Outlet />
      </div>
    </main>
  </div>
);
