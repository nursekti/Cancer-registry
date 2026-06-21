"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useDemoUser } from "@/lib/useDemoUser";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useDemoUser();

  React.useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [router, user]);

  if (!user) return null;
  return <>{children}</>;
}

