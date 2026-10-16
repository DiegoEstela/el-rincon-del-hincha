/** Extracts `--name: value;` custom properties from the first `:root` block of a stylesheet. */
export function parseRootTokens(css: string): Record<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = /:root\s*\{([^}]*)\}/.exec(withoutComments);
  if (!block) throw new Error("No :root block found");

  const tokens: Record<string, string> = {};
  for (const match of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}
