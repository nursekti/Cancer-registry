"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signInDemo } from "@/lib/auth";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f8fafc_0%,_#f3f4f6_100%)] px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-900">
          Cancer Registry RSUD Dr Moewardi
        </h1>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-zinc-900">Login</h2>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!username.trim()) return;
                signInDemo(username.trim());
                router.replace("/type");
              }}
            >
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Enter your username"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <Button
                className="mt-2 h-12 rounded-2xl"
                type="submit"
                disabled={!username.trim() || !password}
              >
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
