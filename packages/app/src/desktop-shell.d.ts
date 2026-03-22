export {};

declare global {
  interface Window {
    desktopShell?: {
      platform: string;
      hostname: string;
    };
  }
}
