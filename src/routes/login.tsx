import { createFileRoute, Link } from "@tanstack/react-router";
import { HermesNote } from "@/components/hermes-note";
import { LoginForm } from "@/components/login-form";
import { getAuthDoors } from "@/lib/auth/doors";

export const Route = createFileRoute("/login")({
  loader: async () => {
    try {
      return await getAuthDoors();
    } catch {
      return { oauthEnabled: false };
    }
  },
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Keep a name — Atman Music" }],
  }),
});

function LoginPage() {
  const { oauthEnabled } = Route.useLoaderData();
  return (
    <main className="min-h-dvh bg-bg px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-sm tracking-[0.16em] text-fg uppercase"
        >
          <HermesNote size="mark" />
          Atman Music
        </Link>
        <p className="mt-12 text-xs font-medium tracking-[0.32em] text-accent uppercase">
          The name
        </p>
        <h1 className="mt-3 max-w-xl font-display text-section text-fg">
          Keep a name. Or remain unnamed.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          Accounts are optional. The wall plays either way. A name remembers
          the marks you leave and the days you return.
        </p>
        <div className="mt-10">
          <LoginForm oauthEnabled={oauthEnabled} />
        </div>
      </div>
    </main>
  );
}
