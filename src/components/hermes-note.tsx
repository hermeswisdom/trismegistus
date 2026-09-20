import { MatrixRain } from "@/components/matrix-rain";
import { cn } from "@/lib/utils";

export function HermesNote({
  playing = false,
  align = "center",
  size = "display",
  active = true,
}: {
  playing?: boolean;
  align?: "center" | "start";
  size?: "display" | "mark";
  active?: boolean;
}) {
  if (size === "mark") {
    return (
      <span className="hermes-mark" aria-hidden="true">
        <MatrixRain compact active={active} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "hermes-lockup",
        align === "start" && "hermes-lockup-start",
        playing && "hermes-lockup-playing",
      )}
    >
      <span className="hermes-word">TRISMEGISTUS</span>
      <span className="hermes-fall">
        <MatrixRain playing={playing} active={active} />
      </span>
    </span>
  );
}
