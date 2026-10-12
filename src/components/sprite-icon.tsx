import { cn } from "@/lib/utils";
import { SPRITE_ICONS, type SpriteIconName } from "@/lib/icon-paths";

/**
 * The tile icons' geometry, once per page (root layout). Hidden and sized 0;
 * <use> references keep working because symbols render through the use site.
 */
export function IconSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute size-0 overflow-hidden">
      <defs>
        {(Object.keys(SPRITE_ICONS) as SpriteIconName[]).map((name) => (
          <symbol key={name} id={`i-${name}`} viewBox="0 0 24 24">
            {SPRITE_ICONS[name].map(([Tag, attrs], i) => {
              const El = Tag as "path";
              return <El key={i} {...(attrs as Record<string, string>)} />;
            })}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/**
 * A lucide-style icon drawn from the sprite. Stroke defaults live in the
 * `.icon` class (styles.css, components layer) so utilities such as
 * `fill-current` or `size-4` still override them.
 */
export function SpriteIcon({ name, className }: { name: SpriteIconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("icon", className)}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
