import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { authEnabled } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { londonDateKey } from "@/lib/daily-tablet";
import { readStreak } from "@/lib/listen-streak";
import { cn } from "@/lib/utils";

export function AccountLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(readStreak(londonDateKey(new Date())).count);
  }, [user]);

  if (!authEnabled) {
    return (
      <Link
        to="/login"
        onClick={onNavigate}
        className={cn(
          "inline-flex min-h-11 items-center text-xs font-medium tracking-[0.22em] text-muted uppercase transition-colors duration-150 hover:text-accent",
          className,
        )}
      >
        Account
      </Link>
    );
  }

  if (isPending) {
    return (
      <span className={cn("text-xs tracking-[0.22em] text-subtle uppercase", className)}>
        …
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        to="/login"
        onClick={onNavigate}
        className={cn(
          "inline-flex min-h-11 items-center text-xs font-medium tracking-[0.22em] text-muted uppercase transition-colors duration-150 hover:text-accent",
          className,
        )}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <UserButton />
      {streak > 0 ? (
        <p className="text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
          {streak} day{streak === 1 ? "" : "s"} at the wall
        </p>
      ) : null}
    </div>
  );
}
