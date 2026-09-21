import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ViewportLock } from "@/components/viewport-lock";
import { DEFAULT_VIEWPORT, PHONE_VIEWPORT_BOOT } from "@/lib/viewport-lock";
import appCss from "../styles.css?url";

const APP_NAME = "Atman Music";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Atman Music. The full SoundCloud catalog. All the cover art.",
      },
      { name: "theme-color", content: "#09080e" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Syne:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content={DEFAULT_VIEWPORT} />
        <script dangerouslySetInnerHTML={{ __html: PHONE_VIEWPORT_BOOT }} />
        <HeadContent />
      </head>
      <body className="bg-bg text-fg font-sans">
        <ViewportLock />
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
