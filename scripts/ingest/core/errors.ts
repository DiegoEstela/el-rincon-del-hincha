// Kept apart from `commit.ts` so pure modules (parsers, normalizers) can throw it without pulling
// in the file system.
export class IngestError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join("\n"));
    this.name = "IngestError";
  }
}
