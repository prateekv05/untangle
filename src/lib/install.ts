export type InstallHint = "prompt" | "ios" | null;

/**
 * Which install hint to show, if any. Never inside the installed app or after the user dismissed it.
 * Chromium browsers hand over a prompt we can trigger; iOS Safari has none, so it gets Add to Home Screen steps.
 */
export function installHint(env: { standalone: boolean; ios: boolean; canPrompt: boolean; dismissed: boolean }): InstallHint {
  if (env.standalone || env.dismissed) return null;
  if (env.canPrompt) return "prompt";
  return env.ios ? "ios" : null;
}

/** iPhone, iPad and the iPads that report as a Mac. */
export const isIos = (ua: string, platform: string, touchPoints: number): boolean =>
  /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
