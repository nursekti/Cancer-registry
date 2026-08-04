"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { signOutDemo } from "@/lib/auth";
import { cn } from "@/lib/cn";
import * as React from "react";
import { useDemoUser } from "@/lib/useDemoUser";

const NAV = [{ href: "/type", label: "Homepage" }];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useDemoUser();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#f3f4f6_100%)]">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/type" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-700 text-sm font-semibold text-white">
                CR
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Cancer Registry
                </div>
                <div className="text-xs text-zinc-500">Clinical data overview</div>
              </div>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-700 text-white"
                        : "text-zinc-700 hover:bg-zinc-100",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user?.username ? (
              <div className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-600 sm:block">
                {user.username}
              </div>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                signOutDemo();
                router.replace("/");
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

