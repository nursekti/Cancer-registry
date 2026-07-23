"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signInDemo } from "@/lib/auth";
import { useRouter } from "next/navigation";
import * as React from "react";

const highlights = [
  {
    title: "Clear navigation",
    description: "Move between registry modules without confusion.",
  },
  {
    title: "Faster lookup",
    description: "Search patient records and HL data in seconds.",
  },
  {
    title: "Simple demo access",
    description: "Open the workspace instantly in your browser.",
  },
];

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8 text-zinc-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,_transparent_0%,_rgba(255,255,255,0.6)_45%,_transparent_100%)]" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center">
        <div className="max-w-xl flex-1 space-y-6">
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-sm font-medium text-emerald-700 shadow-sm backdrop-blur">
            Demo-ready registry workspace
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Make cancer data review feel effortless.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-zinc-600">
              A calmer, more guided experience for managing patient records,
              cancer types, and HL datasets in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur"
              >
                <div className="text-sm font-semibold text-zinc-900">
                  {item.title}
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Card className="w-full max-w-lg border border-zinc-100/80 bg-white/90 shadow-[0_25px_80px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
          <CardHeader className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
              Secure demo access
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900">
              Welcome back
            </h2>
            <p className="text-sm text-zinc-600">
              Use any username and password to explore the workspace.
            </p>
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
                Continue to registry
              </Button>
              <p className="text-center text-xs text-zinc-500">
                Demo login: your data stays in this browser only.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
