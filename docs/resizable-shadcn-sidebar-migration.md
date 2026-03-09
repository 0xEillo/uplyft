# Resizable shadcn Sidebar Migration (Next.js 15)

This repository is currently an Expo Router app (`expo-router/entry`) and does not include a Next.js + shadcn UI setup yet.

If you want to reimplement your sidebar with **shadcn `Sidebar` + `Resizable`** exactly as requested, use this migration checklist in your Next dashboard app:

## 1) Install required UI components

```bash
npx shadcn@latest add sidebar resizable dropdown-menu avatar
npm install lucide-react
```

## 2) Create `components/app-sidebar.tsx`

Use a collapsible icon sidebar with grouped menu sections and user/workspace dropdowns.

```tsx
"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Home,
  BarChart3,
  Users,
  FolderOpen,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="h-full">
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="font-bold">S</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Acme SaaS</span>
                <span className="truncate text-xs text-muted-foreground">Enterprise</span>
              </div>
              <ChevronDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem>Workspace 1</DropdownMenuItem>
            <DropdownMenuItem>Workspace 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/dashboard">
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/analytics">
                    <BarChart3 className="h-4 w-4" />
                    <span>Analytics</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/team">
                    <Users className="h-4 w-4" />
                    <span>Team</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/projects">
                    <FolderOpen className="h-4 w-4" />
                    <span>Projects</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-8 w-8 rounded-full">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm">
                    <span>John Doe</span>
                    <span className="text-xs text-muted-foreground">john@acme.com</span>
                  </div>
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56">
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
```

## 3) Make layout resizable with persistence

```tsx
"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <ResizablePanelGroup
        direction="horizontal"
        className="h-screen"
        autoSaveId="saas-layout"
      >
        <ResizablePanel
          defaultSize={20}
          minSize={15}
          maxSize={35}
          collapsible
          className="min-w-[var(--sidebar-width)]"
        >
          <AppSidebar />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={80} minSize={50}>
          <SidebarInset>
            <header className="flex h-14 items-center border-b px-4">
              <SidebarTrigger />
              <div className="ml-auto">Your header content</div>
            </header>
            <main className="p-6">{children}</main>
          </SidebarInset>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  );
}
```

## 4) Optional polish

- Replace `<a href>` with `next/link` and `usePathname()` for active styles.
- Keep `autoSaveId` stable to persist panel width in `localStorage`.
- Use `collapsible="icon"` to preserve excellent mobile + keyboard behavior.
