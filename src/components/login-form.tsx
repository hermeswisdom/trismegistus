import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { GROK_PROVIDERS } from "@/lib/auth/providers";
import { parseAccountForm, type AccountMode } from "@/lib/auth/account-form";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";

export function LoginForm() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<AccountMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!authEnabled || busy) return;
    const parsed = parseAccountForm({ mode, email, password, name });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "sign-up") {
        const { error: next } = await authClient.signUp.email({
          email: parsed.email,
          password: parsed.password,
          name: parsed.name,
        });
        if (next) throw new Error(next.message ?? "The name would not hold.");
      } else {
        const { error: next } = await authClient.signIn.email({
          email: parsed.email,
          password: parsed.password,
        });
        if (next) throw new Error(next.message ?? "The door did not know you.");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "The door stayed shut.");
      setBusy(false);
    }
  }

  async function onOAuth(providerId: string) {
    if (!authEnabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(providerId, { callbackURL: "/", errorCallbackURL: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The outer door failed.");
      setBusy(false);
    }
  }

  if (authEnabled && isPending) {
    return <p className="text-sm text-muted">The name is still arriving…</p>;
  }

  if (authEnabled && user) {
    return (
      <div className="flex flex-col gap-6">
        <UserButton />
        <p className="text-sm leading-relaxed text-muted">
          The wall knows this name. Listening still works if you leave it.
        </p>
        <Link
          to="/"
          className="inline-flex h-12 w-fit items-center bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase"
        >
          Return to the wall
        </Link>
      </div>
    );
  }

  if (!authEnabled) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm leading-relaxed text-muted">
          The account door is built. Production still has the gate unlit
          (`VITE_AUTH_ENABLED=false`). Light it, set the secrets on the host,
          and this page keeps a name. Until then, remain unnamed — the wall
          still plays.
        </p>
        <Link
          to="/"
          className="inline-flex h-12 w-fit items-center bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase"
        >
          Remain unnamed
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {mode === "sign-up" ? (
          <label className="block">
            <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-base text-fg outline-none focus:border-fg"
            />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-base text-fg outline-none focus:border-fg"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
            Password
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-base text-fg outline-none focus:border-fg"
          />
        </label>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex h-12 w-full touch-manipulation items-center justify-center bg-accent text-xs font-medium tracking-[0.2em] text-bg uppercase disabled:opacity-60"
        >
          {busy ? "Holding" : mode === "sign-up" ? "Take a name" : "Enter with a name"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "sign-up" ? "sign-in" : "sign-up");
          setError(null);
        }}
        className="text-xs tracking-[0.18em] text-muted uppercase hover:text-accent"
      >
        {mode === "sign-up" ? "I already keep a name" : "I have no name yet"}
      </button>

      <div className="flex flex-col gap-2">
        <p className="text-xs tracking-[0.2em] text-subtle uppercase">
          Or a full-page outer door
        </p>
        {GROK_PROVIDERS.map((provider) => (
          <button
            key={provider.providerId}
            type="button"
            disabled={busy}
            onClick={() => onOAuth(provider.providerId)}
            className="inline-flex h-12 w-full touch-manipulation items-center justify-center border border-border bg-elevated text-xs font-medium tracking-[0.18em] text-fg uppercase disabled:opacity-60"
          >
            Continue with {provider.label}
          </button>
        ))}
      </div>

      <Link
        to="/"
        className="text-xs tracking-[0.2em] text-subtle uppercase hover:text-accent"
      >
        Remain unnamed — the wall still plays
      </Link>
    </div>
  );
}
