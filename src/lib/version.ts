export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";

export const CREDITS = {
  author: "Diego Estela Lopez",
  originalIdea: "Juan Farre",
} as const;

export function formatVersion(version = APP_VERSION, commit = APP_COMMIT): string {
  return `v${version} · ${commit}`;
}
