import { Link } from "@tanstack/react-router";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isSignedInForSaves } from "@/lib/favorites-sync";
import { cn } from "@/lib/utils";

export function AccountNudge({
  className,
  forMarks = false,
}: {
  className?: string;
  forMarks?: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  if (!authEnabled || isPending) return null;

  const signedIn = isSignedInForSaves({
    authEnabled,
    userId: user?.id,
    isDevFallback: user?.isDevFallback,
  });

  if (signedIn) {
    const name = (user?.displayName ?? user?.primaryEmail ?? "you").trim();
    return (
      <p className={cn("text-xs leading-relaxed text-subtle", className)}>
        {forMarks
          ? `Marks leave as ${name}. The board still stays unnamed.`
          : `Signed in as ${name}. Saved tablets travel with the name.`}
      </p>
    );
  }

  return (
    <p className={cn("text-xs leading-relaxed text-subtle", className)}>
      <Link
        to="/login"
        className="text-accent underline-offset-4 hover:underline"
      >
        Keep a name
      </Link>
      {forMarks
        ? " so a mark feels like yours. The wall still plays unnamed."
        : " to save tablets and resume the last one on return."}
    </p>
  );
}
