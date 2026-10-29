"use client";

import { useState } from "react";
import { copy } from "@/lib/copy.id";
import { Button } from "@/components/ui/Button";

export default function OperatorLoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/operator/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(copy.operator.login.wrong);
      return;
    }
    window.location.href = "/operator";
  };

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border-4 border-ink bg-paper p-6 shadow-brut-xl"
      >
        <h1 className="font-display text-2xl uppercase">{copy.brand.name}</h1>
        <p className="mb-4 font-mono text-xs uppercase text-ink/60">
          {copy.operator.login.title}
        </p>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-display uppercase">{copy.operator.login.pin}</span>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ""))}
            className="border-4 border-ink bg-white px-3 py-2 font-mono text-2xl tracking-[0.5em]"
          />
        </label>

        {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}

        <Button type="submit" variant="primary" size="md" className="mt-4 w-full" disabled={busy}>
          {copy.operator.login.submit}
        </Button>
      </form>
    </main>
  );
}
