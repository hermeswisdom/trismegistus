import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { InstallAppProvider } from "@/components/install-app";
import { OfflineRuntime } from "@/components/offline-runtime";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { INSTALL_CAPTURE_SCRIPT } from "@/lib/install-app";
import { SITE_FONT_PRELOADS } from "@/lib/site-fonts";
import { SiteBackdrop } from "@/components/site-backdrop";
import { ViewportLock } from "@/components/viewport-lock";
import { DEFAULT_VIEWPORT, PHONE_VIEWPORT_BOOT } from "@/lib/viewport-lock";
import { siteVerificationMeta } from "@/lib/seo";
import appCss from "../styles.css?inline";

const APP_NAME = "Atman Music";

/** GOOGLE_SITE_VERIFICATION, inlined at build (vite.config.ts). Empty: no tag. */
declare const __GOOGLE_SITE_VERIFICATION__: string;
const GOOGLE_SITE_VERIFICATION =
  typeof __GOOGLE_SITE_VERIFICATION__ === "string" ? __GOOGLE_SITE_VERIFICATION__ : "";

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
      // Home-screen install (public/manifest.webmanifest).
      // Service worker is scoped to a public offline shell + saved listening copies.
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      ...siteVerificationMeta(GOOGLE_SITE_VERIFICATION),
    ],
    links: [
      { rel: "icon", href: "/brand/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/brand/mark-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/brand/mark-16.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content={DEFAULT_VIEWPORT} />
        <style dangerouslySetInnerHTML={{ __html: appCss }} />
        {SITE_FONT_PRELOADS.map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
        ))}
        <script dangerouslySetInnerHTML={{ __html: PHONE_VIEWPORT_BOOT }} />
        {/* Before hydration: keep an early beforeinstallprompt for "Install app". */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
        {/* SoundCloud widget API, loaded early: it must be listening before the
            player iframe posts READY (see now-playing.tsx). */}
        <script async src="https://w.soundcloud.com/player/api.js" />
        <HeadContent />
      </head>
      <body className="bg-bg text-fg font-sans">
        <SiteBackdrop />
        <div className="relative z-10">
          <ViewportLock />
          <PreviewHostBridge />
          <AuthProvider>
            <InstallAppProvider>
              <OfflineRuntime />
              <Outlet />
            </InstallAppProvider>
          </AuthProvider>
        </div>
        <Scripts />
      </body>
    </html>
  ),
});
