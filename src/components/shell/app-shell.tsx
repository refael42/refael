"use client";
import {
  Bell,
  Building2,
  CalendarRange,
  CheckCheck,
  ClipboardList,
  FileBarChart,
  FileText,
  HardHat,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Network,
  Plus,
  Settings,
  Workflow,
  Settings2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, switchProjectForm } from "@/app/actions/auth";
import { SetupBanner } from "./setup-banner";
import { InstallButton } from "@/components/common/install-button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MemberRole } from "@/lib/db/types";
import { t } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import { navFor, type NavKey } from "./nav-items";

const ICONS: Record<NavKey, LucideIcon> = {
  home: Home,
  my: HardHat,
  chat: MessageCircle,
  approvals: CheckCheck,
  graph: Network,
  overview: LayoutDashboard,
  tasks: ListChecks,
  plans: FileText,
  ask: Sparkles,
  gantt: CalendarRange,
  templates: Settings2,
  notifications: Bell,
  settings: Settings,
  report: FileBarChart,
  flow: Workflow,
};

export interface ShellProps {
  role: MemberRole;
  userName: string;
  projectName: string;
  isDemo: boolean;
  counts: Partial<Record<NavKey, number>>;
  projects: Array<{ id: string; name: string }>;
  projectId: string;
  canCreateProject: boolean;
  setupMode: boolean;
  children: React.ReactNode;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function CountBadge({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "num inline-flex min-w-5 items-center justify-center rounded-full bg-state-blocked px-1.5 text-[11px] font-bold leading-5 text-white",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function AppShell({ role, userName, projectName, isDemo, counts, projects, projectId, canCreateProject, setupMode, children }: ShellProps) {
  const pathname = usePathname();
  const { primary, rest } = navFor(role);
  const all = [...primary, ...rest];

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar (start side = right in RTL) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e bg-muted/30 print:hidden lg:flex">
        <div className="flex items-center gap-2 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-bold">{t.app.name}</span>
            <span className="truncate text-xs text-muted-foreground">{projectName}</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
          {all.map((item) => {
            const Icon = ICONS[item.key];
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                <CountBadge n={counts[item.key]} />
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{userName}</div>
          <div>{t.roles[role]}</div>
          <form action={logout} className="mt-2">
            <button className="flex items-center gap-1 hover:text-foreground" type="submit">
              <LogOut className="h-3.5 w-3.5" />
              {isDemo ? t.nav.switchUser : t.nav.logout}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 print:hidden items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="h-4 w-4" />
            </div>
            <span className="truncate text-sm font-semibold">{projectName}</span>
          </div>
          <div className="hidden flex-1 lg:block">
            <span className="text-sm text-muted-foreground">{projectName}</span>
          </div>
          <InstallButton />
          {isDemo && <Badge variant="secondary">{t.app.demoBadge}</Badge>}
          <Link href="/notifications" className="relative rounded-full p-2 hover:bg-accent" aria-label={t.nav.notifications}>
            <Bell className="h-5 w-5" />
            <CountBadge n={counts.notifications} className="absolute -end-0.5 -top-0.5" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {initials(userName)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span>{userName}</span>
                <span className="text-xs font-normal text-muted-foreground">{t.roles[role]}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projects.length > 1 && (
                <>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t.setup.switchProject}</DropdownMenuLabel>
                  {projects.map((p) => (
                    <DropdownMenuItem key={p.id} asChild disabled={p.id === projectId}>
                      <form action={switchProjectForm} className="w-full">
                        <input type="hidden" name="projectId" value={p.id} />
                        <button type="submit" className={cn("flex w-full items-center gap-2 text-start", p.id === projectId && "font-semibold")}>
                          <Building2 />
                          <span className="truncate">{p.name}</span>
                        </button>
                      </form>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {canCreateProject && (
                <DropdownMenuItem asChild>
                  <Link href="/setup">
                    <Plus />
                    {t.setup.newProject}
                  </Link>
                </DropdownMenuItem>
              )}
              {rest.map((item) => {
                const Icon = ICONS[item.key];
                return (
                  <DropdownMenuItem key={item.key} asChild className="lg:hidden">
                    <Link href={item.href}>
                      <Icon />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              {rest.length > 0 && <DropdownMenuSeparator className="lg:hidden" />}
              <DropdownMenuItem asChild>
                <form action={logout} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut />
                    {isDemo ? t.nav.switchUser : t.nav.logout}
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {setupMode && <SetupBanner isPM={role === "pm"} />}
        <main className="flex-1 pb-20 lg:pb-6">{children}</main>

        {/* Mobile bottom bar */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur print:hidden lg:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${primary.length + (rest.length ? 1 : 0)}, minmax(0, 1fr))` }}>
            {primary.map((item) => {
              const Icon = ICONS[item.key];
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 py-2 text-[11px]",
                    active ? "font-semibold text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.short ?? item.label}</span>
                  <CountBadge n={counts[item.key]} className="absolute end-[22%] top-1" />
                </Link>
              );
            })}
            {rest.length > 0 && <MoreMenu items={rest} />}
          </div>
        </nav>
      </div>
    </div>
  );
}

function MoreMenu({ items }: { items: ReturnType<typeof navFor>["rest"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground">
        <Menu className="h-5 w-5" />
        <span>{t.app.more}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        {items.map((item) => {
          const Icon = ICONS[item.key] ?? ClipboardList;
          return (
            <DropdownMenuItem key={item.key} asChild>
              <Link href={item.href}>
                <Icon />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
