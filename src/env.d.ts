/// <reference types="astro/client" />
/// <reference types="@vite-pwa/astro" />

declare module "virtual:pwa-info" {
  export const pwaInfo: { webManifest: { linkTag: string } } | undefined;
}
