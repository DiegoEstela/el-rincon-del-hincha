import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Changelog" };

function loadChangelog(): string {
  const file = join(process.cwd(), "CHANGELOG.md");
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

export default function ChangelogPage() {
  const content = loadChangelog();

  return (
    <article className="rise mt-6">
      <h1 className="font-display text-5xl">Novedades</h1>
      {content ? (
        <pre className="glass text-muted mt-4 overflow-x-auto rounded-2xl p-4 text-sm whitespace-pre-wrap">
          {content}
        </pre>
      ) : (
        <p className="text-muted mt-3">Todavía no hay versiones publicadas.</p>
      )}
    </article>
  );
}
