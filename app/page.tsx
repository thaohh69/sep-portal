"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { MENU_OPTIONS, type MenuKey, findMenuLabel } from "@/lib/app-config";
import { cn } from "@/lib/utils";
import { StaffManagementPanel } from "@/components/staff-management";
import { EventFlowPanel } from "@/components/event-flow-panel";
import { TaskDistributionPanel } from "@/components/task-distribution-panel";
import { RecruitmentPanel } from "@/components/recruitment-panel";
import { FinancialManagementPanel } from "@/components/financial-management-panel";
import { ClientManagementPanel } from "@/components/client-management-panel";

export default function HomePage() {
  const { profile, isInitializing, logout } = useAuth();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("home");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setActiveMenu("home");
    }
  }, [profile]);

  const handleLogout = async () => {
    await logout();
    setFeedback("You have signed out. The session ended safely.");
  };

  const isMenuAccessible = (menuKey: MenuKey) => {
    if (menuKey === "home") {
      return true;
    }
    if (!profile) {
      return false;
    }
    if (menuKey === "staff-management" && profile.role !== "HR") {
      return false;
    }
    return profile.permissions.includes(menuKey);
  };

  const handleMenuClick = (menuKey: MenuKey) => {
    if (!isMenuAccessible(menuKey)) {
      setFeedback(
        profile
          ? "Your role does not have permission to open this module."
          : "Please sign in before accessing the available modules.",
      );
      return;
    }
    setFeedback(null);
    setActiveMenu(menuKey);
  };

  const sidebarItems = useMemo(() => MENU_OPTIONS, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-6">
          <h1 className="text-lg font-semibold text-slate-800">
            SEP Internal Management System
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Swedish Events Planners - Internal Portal
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-2">
            {sidebarItems.map((menu) => {
              const accessible = isMenuAccessible(menu.value);
              const isActive = activeMenu === menu.value;
              const forceGray = !profile;
              const displayAsDisabled =
                forceGray || (!accessible && menu.value !== "home");

              return (
                <li key={menu.value}>
                  <button
                    type="button"
                    onClick={() => handleMenuClick(menu.value)}
                    className={cn(
                      "w-full rounded-md border px-4 py-2 text-left text-sm transition focus:outline-none",
                      isActive && profile && accessible
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-transparent",
                      displayAsDisabled
                        ? "cursor-not-allowed text-slate-400"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    {menu.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <section className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <div>
            <p className="text-sm font-medium text-slate-700">
              Active module: {findMenuLabel(activeMenu)}
            </p>
            {profile ? (
              <p className="text-xs text-slate-500">
                Signed in as {profile.username} ({profile.role})
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                You are browsing as a guest. Sign in to unlock features.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            {profile ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
          {isInitializing ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Initializing the system. Please wait...
            </div>
          ) : (
            <>
              {feedback && (
                <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {feedback}
                </div>
              )}
              <ModuleContent
                activeMenu={activeMenu}
                isAccessible={isMenuAccessible(activeMenu)}
              />
            </>
          )}
        </main>
      </section>
    </div>
  );
}

type ModuleContentProps = {
  activeMenu: MenuKey;
  isAccessible: boolean;
};

function ModuleContent({ activeMenu, isAccessible }: ModuleContentProps) {
  const { profile } = useAuth();

  if (activeMenu === "home") {
    return profile ? (
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-800">
          Hello, {profile.username}!
        </h2>
        <p className="text-slate-600">
          Welcome to the SEP internal management system. Choose a module from the left panel to continue.
        </p>
      </div>
    ) : (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-800">
          Welcome to the SEP Internal Management System
        </h2>
        <p className="text-slate-600">
          Please sign in to continue. New staff accounts are provisioned by HR.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <AccessDeniedCard message="Please sign in before accessing this module." />
    );
  }

  if (!isAccessible) {
    return (
      <AccessDeniedCard message="Your role cannot access this module. Contact HR if you need additional permissions." />
    );
  }

  if (activeMenu === "staff-management") {
    if (profile.role !== "HR") {
      return (
        <AccessDeniedCard message="Staff management is available to HR users only." />
      );
    }
    return (
      <div className="space-y-6">
        <SectionHeader title="Staff Management" />
        <StaffManagementPanel />
      </div>
    );
  }

  if (activeMenu === "event-flow") {
    return <EventFlowPanel />;
  }

  if (activeMenu === "task-distribution") {
    return <TaskDistributionPanel />;
  }

  if (activeMenu === "client-management") {
    return <ClientManagementPanel />;
  }

  if (activeMenu === "recruitment") {
    return <RecruitmentPanel />;
  }

  if (activeMenu === "financial-management") {
    return <FinancialManagementPanel />;
  }

  return (
    <ModulePlaceholder title={findMenuLabel(activeMenu)} />
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-slate-200 pb-3">
      <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500">
        Detailed workflows will be added in later iterations.
      </p>
    </div>
  );
}

function AccessDeniedCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-8 text-slate-700">
      <h3 className="text-lg font-semibold text-rose-700">Access denied</h3>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}

function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-10">
      <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
      <p className="text-slate-600">
        This module currently serves as a placeholder. Detailed business workflows will be provided later.
      </p>
    </div>
  );
}
