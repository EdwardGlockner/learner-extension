import type { PropsWithChildren, ReactNode } from "react";

type AppShellProps = PropsWithChildren<{
  activePage: "dashboard" | "manage" | "history" | "options";
  title: string;
  subtitle: string;
  actions?: ReactNode;
}>;

const navItems: Array<{ id: AppShellProps["activePage"]; label: string; href: string }> = [
  { id: "dashboard", label: "Today", href: "/dashboard.html" },
  { id: "manage", label: "Topics", href: "/manage.html" },
  { id: "history", label: "History", href: "/history.html" },
  { id: "options", label: "Settings", href: "/options.html" }
];

export function AppShell({ activePage, title, subtitle, actions, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LP</div>
          <div>
            <p className="eyebrow">learning-plugin</p>
            <h1>Daily learning dashboard</h1>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => (
            <a
              key={item.id}
              className={item.id === activePage ? "nav-item nav-item-active" : "nav-item"}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <p className="eyebrow">Design notes</p>
          <p>Plan 2 or 3 topics per day, respect prerequisites, and keep the queue editable.</p>
        </div>
      </aside>
      <main className="page-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{title}</h2>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          <div className="header-actions">{actions}</div>
        </header>
        {children}
      </main>
    </div>
  );
}
