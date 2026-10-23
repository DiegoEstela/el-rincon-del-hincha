// Cuts an excerpt out of the bytes of a page (plan 0017, ADR 0020 decision 1). The markers are exact
// byte strings; the output is a byte-exact subarray, never decoded or edited, so a record can always
// be checked against the very bytes it came from.

function find(page: Uint8Array, marker: string, from: number): number {
  return Buffer.from(page.buffer, page.byteOffset, page.byteLength).indexOf(
    Buffer.from(marker, "latin1"),
    from,
  );
}

/** Bytes from the start marker up to, and not including, the first end marker after it. */
export function sliceExcerpt(page: Uint8Array, start: string, end: string): Uint8Array {
  if (start === "" || end === "")
    throw new Error("an excerpt needs a non-empty start and end marker");
  const first = find(page, start, 0);
  if (first === -1) throw new Error(`start marker ${JSON.stringify(start)} not found in the page`);
  if (find(page, start, first + 1) !== -1) {
    throw new Error(`start marker ${JSON.stringify(start)} appears more than once in the page`);
  }
  const last = find(page, end, first + start.length);
  if (last === -1) {
    const before = find(page, end, 0) !== -1 && find(page, end, 0) < first;
    throw new Error(
      before
        ? `end marker ${JSON.stringify(end)} is not after the start marker`
        : `end marker ${JSON.stringify(end)} not found after the start marker`,
    );
  }
  return page.subarray(first, last);
}
