"use client";

import AdminSidebarNav from "./AdminSidebarNav";

export interface SidebarProps {
  activePage?: string;
  onItemClick?: () => void;
}

export function Sidebar({ onItemClick }: SidebarProps) {
  return <AdminSidebarNav onItemClick={onItemClick} />;
}

export default AdminSidebarNav;
