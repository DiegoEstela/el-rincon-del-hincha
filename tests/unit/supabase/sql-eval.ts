// Tiny evaluator of the boolean subset of SQL used in the row-level CHECK constraints (plan 0006).
// It implements Postgres three-valued logic (NULL is "unknown") so a test can ask what the
// database would do with a row. It throws on anything it does not understand, so a check that
// grows beyond the subset is a red test instead of a silent pass.

export type Value = string | number | boolean | null;
export type Row = Record<string, Value>;

const TOKEN =
  /\s*(?:(<>|>=|<=|=|<|>|\+|-|\(|\)|,)|('(?:[^']|'')*')|("[^"]+"|[A-Za-z_]\w*)|(\d+(?:\.\d+)?))/y;

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    if (/^\s*$/.test(text.slice(TOKEN.lastIndex))) break;
    const m = TOKEN.exec(text);
    if (m === null) {
      throw new Error(`Unsupported SQL near "${text.slice(TOKEN.lastIndex, TOKEN.lastIndex + 20)}"`);
    }
    tokens.push(m[1] ?? m[2] ?? m[3] ?? m[4]!);
  }
  return tokens;
}

/** Compiles a check expression to a function from a row to true, false or null (unknown). */
export function compileCheck(expression: string): (row: Row) => boolean | null {
  const tokens = tokenize(expression);
  let pos = 0;
  const peek = () => tokens[pos]?.toLowerCase();
  const next = () => tokens[pos++]!;
  const accept = (...words: string[]) => {
    if (words.every((w, i) => tokens[pos + i]?.toLowerCase() === w)) {
      pos += words.length;
      return true;
    }
    return false;
  };

  type Node = (row: Row) => Value;

  const primary = (): Node => {
    if (accept("(")) {
      const inner = or();
      if (!accept(")")) throw new Error("Expected )");
      return inner;
    }
    const tok = next();
    if (/^'/.test(tok)) {
      const text = tok.slice(1, -1).replace(/''/g, "'");
      return () => text;
    }
    if (/^\d/.test(tok)) return () => Number(tok);
    const word = tok.toLowerCase();
    if (word === "null") return () => null;
    if (word === "true") return () => true;
    if (word === "false") return () => false;
    const name = tok.replace(/^"(.*)"$/, "$1");
    return (row) => {
      if (!(name in row)) throw new Error(`Unknown column ${name}`);
      return row[name]!;
    };
  };

  const sum = (): Node => {
    let left = primary();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const l = left;
      const r = primary();
      left = (row) => {
        const a = l(row);
        const b = r(row);
        if (a === null || b === null) return null;
        return op === "+" ? (a as number) + (b as number) : (a as number) - (b as number);
      };
    }
    return left;
  };

  const compare = (op: string, a: Value, b: Value): boolean | null => {
    if (a === null || b === null) return null;
    switch (op) {
      case "=":
        return a === b;
      case "<>":
        return a !== b;
      case "<":
        return a < b;
      case "<=":
        return a <= b;
      case ">":
        return a > b;
      default:
        return a >= b;
    }
  };

  const predicate = (): Node => {
    if (accept("not")) {
      const inner = predicate();
      return (row) => {
        const v = inner(row);
        return v === null ? null : !v;
      };
    }
    const left = sum();
    if (accept("is")) {
      const negated = accept("not");
      if (accept("null")) return (row) => (left(row) === null) !== negated;
      if (accept("distinct", "from")) {
        const right = sum();
        return (row) => (left(row) !== right(row)) !== negated;
      }
      throw new Error("Unsupported IS clause");
    }
    const negated = accept("not");
    if (accept("in")) {
      if (!accept("(")) throw new Error("Expected ( after in");
      const items: Node[] = [sum()];
      while (accept(",")) items.push(sum());
      if (!accept(")")) throw new Error("Expected )");
      return (row) => {
        const v = left(row);
        if (v === null) return null;
        const values = items.map((i) => i(row));
        const hit = values.some((x) => x === v);
        const result = hit ? true : values.some((x) => x === null) ? null : false;
        return result === null ? null : result !== negated;
      };
    }
    if (negated) throw new Error("Unsupported NOT");
    if (["=", "<>", "<", "<=", ">", ">="].includes(peek() ?? "")) {
      const op = next();
      const right = sum();
      return (row) => compare(op, left(row), right(row));
    }
    return left;
  };

  const and = (): Node => {
    let left = predicate();
    while (accept("and")) {
      const l = left;
      const r = predicate();
      left = (row) => {
        const a = l(row);
        if (a === false) return false;
        const b = r(row);
        if (b === false) return false;
        return a === null || b === null ? null : true;
      };
    }
    return left;
  };

  function or(): Node {
    let left = and();
    while (accept("or")) {
      const l = left;
      const r = and();
      left = (row) => {
        const a = l(row);
        if (a === true) return true;
        const b = r(row);
        if (b === true) return true;
        return a === null || b === null ? null : false;
      };
    }
    return left;
  }

  const root = or();
  if (pos !== tokens.length) throw new Error(`Unexpected "${tokens[pos]}" in: ${expression}`);
  return (row) => {
    const v = root(row);
    if (v !== null && typeof v !== "boolean") throw new Error(`Not a boolean: ${expression}`);
    return v;
  };
}

/**
 * True when Postgres would accept the row: a CHECK passes when it evaluates to true or NULL and
 * only fails on false. `skip` lists checks (by exact text) the evaluator does not support.
 */
export function accepts(checks: string[], row: Row, skip: (check: string) => boolean): boolean {
  return checks.filter((c) => !skip(c)).every((c) => compileCheck(c)(row) !== false);
}
