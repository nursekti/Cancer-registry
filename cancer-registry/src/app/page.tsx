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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 px-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-zinc-200 to-zinc-100 blur-3xl" />

      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight">cancer</h1>
          <h2 className="mt-1 text-4xl font-semibold tracking-tight">
            registry
          </h2>
        </CardHeader>
        <CardContent>
          <form
            className="mx-auto mt-2 grid w-full max-w-md gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!username.trim()) return;
              signInDemo(username.trim());
              router.replace("/type");
            }}
          >
            <Input
              label="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="masukkan username"
            />
            <Input
              label="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="masukkan password"
            />
            <Button
              className="mt-2 h-12 rounded-2xl"
              type="submit"
              disabled={!username.trim() || !password}
            >
              Login
            </Button>
            <p className="text-center text-xs text-zinc-500">
              Demo login: data disimpan di browser (localStorage).
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
