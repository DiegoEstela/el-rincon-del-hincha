// Dependency-free extractor of the facts the security and parity tests need from the migrations
// (plan 0006). It recognizes a fixed set of statement shapes and fails loudly on a `create table`,
// `grant` or `revoke` it cannot parse, so a style slip is a red test instead of a silent pass.

export type Column = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  checks: string[];
};
export type Table = {
  name: string;
  file: number;
  columns: Column[];
  primaryKey: string[];
  /** Check expressions, inline and table-level. */
  checks: string[];
  /** Other constraints: references, unique, foreign key (raw text). */
  constraints: string[];
};
export type Policy = { name: string; table: string; command: string; roles: string[] };
export type TableGrant = {
  action: "grant" | "revoke";
  privileges: string[];
  table: string;
  roles: string[];
};
export type FunctionGrant = {
  action: "grant" | "revoke";
  privileges: string[];
  fn: string;
  roles: string[];
};
export type SqlFunction = {
  name: string;
  file: number;
  securityDefiner: boolean;
  searchPath: string | null;
  body: string;
};
export type Index = { name: string; table: string; unique: boolean; columns: string[] };
export type Statement = { file: number; text: string };
export type DefaultPrivilege = {
  action: "revoke";
  privileges: string[];
  objects: string;
  roles: string[];
};

export type Model = {
  tables: Map<string, Table>;
  /** Table name to the index of the file that enables row level security on it. */
  rls: Map<string, number>;
  /** Tables on which a migration disables or forces row level security (both are rejected). */
  rlsDisabled: Map<string, number>;
  rlsForced: Map<string, number>;
  policies: Policy[];
  tableGrants: TableGrant[];
  functionGrants: FunctionGrant[];
  functions: Map<string, SqlFunction>;
  indexes: Index[];
  defaultPrivileges: DefaultPrivilege[];
  extensions: string[];
  statements: Statement[];
  /** Statements outside the allowlist of statement heads; the security gate rejects them. */
  unrecognized: Statement[];
};

const ALL_PRIVILEGES = [
  "select",
  "insert",
  "update",
  "delete",
  "truncate",
  "references",
  "trigger",
];

const DOLLAR_TAG = /^\$[A-Za-z_]*\$/;

/** Removes comments, splits on top-level semicolons and hides dollar-quoted bodies. */
function scan(sql: string, bodies: string[]): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
    } else if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      current += " ";
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      if (quote === "'" && /^[eE]$/.test(sql[i - 1] ?? "") && !/[\w$]/.test(sql[i - 2] ?? " ")) {
        throw new Error("Escape string literals (E'...') are not supported by the SQL model");
      }
      let j = i + 1;
      while (j < sql.length && !(sql[j] === quote && sql[j + 1] !== quote)) {
        j += sql[j] === quote ? 2 : 1;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
    } else if (DOLLAR_TAG.test(rest) && !/[\w$]/.test(sql[i - 1] ?? " ")) {
      const tag = DOLLAR_TAG.exec(rest)![0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end === -1) throw new Error(`Unterminated dollar quote ${tag}`);
      bodies.push(scan(sql.slice(i + tag.length, end), []).join("; "));
      current += `__BODY${bodies.length - 1}__`;
      i = end + tag.length;
    } else if (sql[i] === ";") {
      statements.push(current);
      current = "";
      i += 1;
    } else {
      current += sql[i];
      i += 1;
    }
  }
  statements.push(current);
  return statements.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s !== "");
}

/** True only for exactly one `select cron.schedule(...)` or `select cron.unschedule(...)` call. */
function isCronCall(stmt: string): boolean {
  const skeleton = stmt.replace(/'(?:[^']|'')*'/g, "'S'");
  return (
    /^select cron\.schedule\('S', 'S', (?:'S'|__BODY\d+__)\)$/i.test(skeleton) ||
    /^select cron\.unschedule\('S'\)(?: where exists \(select 1 from cron\.job where jobname = 'S'\))?$/i.test(
      skeleton,
    )
  );
}

/** Splits on commas that are outside parentheses, brackets and quotes. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const ch of text) {
    if (quote !== "") {
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0 && quote === "") {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}

/** Text inside the parentheses that open at `open` (the index of "("), and the index after it. */
function balanced(text: string, open: number): { inner: string; end: number } | null {
  let depth = 0;
  let quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i]!;
    if (quote !== "") {
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

const unquote = (ident: string) =>
  ident
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .toLowerCase();
const roleList = (text: string) => splitTop(text).map(unquote);
const privilegeList = (text: string) =>
  splitTop(text).map((p) => p.toLowerCase().replace(/ privileges$/, ""));

function parseCreateTable(stmt: string, file: number): Table {
  const head = /^create table (?:if not exists )?(?:public\.)?("?\w+"?) \(/i.exec(stmt);
  if (head === null) throw new Error(`Cannot parse create table: ${stmt.slice(0, 80)}`);
  const block = balanced(stmt, head[0].length - 1);
  if (block === null) throw new Error(`Cannot parse create table: ${stmt.slice(0, 80)}`);
  const table: Table = {
    name: unquote(head[1]!),
    file,
    columns: [],
    primaryKey: [],
    checks: [],
    constraints: [],
  };
  for (const item of splitTop(block.inner)) {
    const body = item.replace(/^constraint \S+ /i, "");
    const pk = /^primary key \((.*)\)$/i.exec(body);
    if (pk !== null) {
      table.primaryKey = roleList(pk[1]!);
      continue;
    }
    if (/^check \(/i.test(body)) {
      table.checks.push(balanced(body, body.indexOf("("))!.inner.trim());
      continue;
    }
    if (/^(unique|foreign key|exclude)\b/i.test(body)) {
      table.constraints.push(body);
      continue;
    }
    const col = /^("[^"]+"|\w+) (.+)$/.exec(item);
    if (col === null) {
      throw new Error(`Cannot parse column "${item}" in create table ${table.name}`);
    }
    const name = unquote(col[1]!);
    const spec = col[2]!;
    const typeEnd = spec.search(
      /\b(not null|null|primary key|default|references|check|constraint|unique|generated)\b/i,
    );
    const type = (typeEnd === -1 ? spec : spec.slice(0, typeEnd)).trim().toLowerCase();
    if (type === "") throw new Error(`Column "${name}" of ${table.name} has no type`);
    const primary = /\bprimary key\b/i.test(spec);
    const checks: string[] = [];
    for (const m of spec.matchAll(/\bcheck \(/gi)) {
      checks.push(balanced(spec, m.index + m[0].length - 1)!.inner.trim());
    }
    const def =
      /\bdefault (.+?)(?= (?:not null|null|check|references|primary key|unique|constraint)\b|$)/i.exec(
        spec,
      );
    const ref = /\breferences .*$/i.exec(spec);
    if (primary) table.primaryKey = [name];
    if (ref !== null) table.constraints.push(`${name} ${ref[0]}`);
    table.checks.push(...checks);
    table.columns.push({
      name,
      type,
      nullable: !primary && !/\bnot null\b/i.test(spec),
      default: def === null ? null : def[1]!,
      checks,
    });
  }
  return table;
}

export function parseMigrations(files: string[]): Model {
  const model: Model = {
    tables: new Map(),
    rls: new Map(),
    rlsDisabled: new Map(),
    rlsForced: new Map(),
    policies: [],
    tableGrants: [],
    functionGrants: [],
    functions: new Map(),
    indexes: [],
    defaultPrivileges: [],
    extensions: [],
    statements: [],
    unrecognized: [],
  };
  files.forEach((sql, file) => {
    const bodies: string[] = [];
    for (const stmt of scan(sql, bodies)) {
      model.statements.push({ file, text: stmt });
      let m: RegExpExecArray | null;
      if (/^create table\b/i.test(stmt)) {
        const table = parseCreateTable(stmt, file);
        model.tables.set(table.name, table);
      } else if (
        (m =
          /^alter table (?:only )?(?:public\.)?("?\w+"?) (enable|disable|force) row level security$/i.exec(
            stmt,
          ))
      ) {
        const mode = m[2]!.toLowerCase();
        const target =
          mode === "enable" ? model.rls : mode === "disable" ? model.rlsDisabled : model.rlsForced;
        target.set(unquote(m[1]!), file);
      } else if ((m = /^create policy ("[^"]+"|\w+) on (?:public\.)?(\w+)(.*)$/i.exec(stmt))) {
        const rest = m[3]!;
        model.policies.push({
          name: unquote(m[1]!),
          table: m[2]!.toLowerCase(),
          command:
            /\bfor (all|select|insert|update|delete)\b/i.exec(rest)?.[1]?.toLowerCase() ?? "all",
          roles: roleList(
            /\bto ([\w", ]+?)(?= using\b| with check\b|$)/i.exec(rest)?.[1] ?? "public",
          ),
        });
      } else if (
        (m =
          /^alter default privileges (?:for (?:role|user) \S+ )?(?:in schema \S+ )?revoke (.+?) on (tables|functions|sequences|types|schemas) from (.+)$/i.exec(
            stmt,
          ))
      ) {
        model.defaultPrivileges.push({
          action: "revoke",
          privileges: privilegeList(m[1]!),
          objects: m[2]!.toLowerCase(),
          roles: roleList(m[3]!),
        });
      } else if ((m = /^create extension (?:if not exists )?("?[\w-]+"?)/i.exec(stmt))) {
        model.extensions.push(unquote(m[1]!));
      } else if (isCronCall(stmt)) {
        // A single pg_cron schedule or unschedule call is the only select migrations may contain.
      } else if (/^(grant|revoke)\b/i.test(stmt)) {
        const action = stmt.slice(0, 5).toLowerCase() === "grant" ? "grant" : "revoke";
        const fn =
          /^(?:grant|revoke) (.+?) on function (?:public\.)?(\w+)\s*\(.*\) (?:to|from) (.+?)(?: with grant option)?$/i.exec(
            stmt,
          );
        const tb =
          /^(?:grant|revoke) (.+?) on (?:table )?(?:public\.)?(\w+) (?:to|from) (.+?)(?: with grant option)?$/i.exec(
            stmt,
          );
        if (fn !== null) {
          model.functionGrants.push({
            action,
            privileges: privilegeList(fn[1]!),
            fn: fn[2]!.toLowerCase(),
            roles: roleList(fn[3]!),
          });
        } else if (tb !== null && !/^(all|function|sequence|schema)$/i.test(tb[2]!)) {
          model.tableGrants.push({
            action,
            privileges: privilegeList(tb[1]!),
            table: tb[2]!.toLowerCase(),
            roles: roleList(tb[3]!),
          });
        } else throw new Error(`Cannot parse ${action}: ${stmt.slice(0, 100)}`);
      } else if ((m = /^create (?:or replace )?function (?:public\.)?(\w+)\s*\(/i.exec(stmt))) {
        const rest = stmt.slice(balanced(stmt, m[0].length - 1)?.end ?? m[0].length);
        const search = /\bset search_path\s*(?:=|to)\s*('[^']*'|[^\s,]+)/i.exec(rest);
        const bodyRef = /__BODY(\d+)__/.exec(rest);
        model.functions.set(m[1]!.toLowerCase(), {
          name: m[1]!.toLowerCase(),
          file,
          securityDefiner: /\bsecurity definer\b/i.test(rest),
          searchPath: search === null ? null : search[1]!.replace(/^'(.*)'$/, "$1"),
          body: bodyRef === null ? "" : bodies[Number(bodyRef[1])]!,
        });
      } else if (
        (m =
          /^create (unique )?index (?:if not exists )?(\w+) on (?:public\.)?(\w+) (?:using \w+ )?\(/i.exec(
            stmt,
          ))
      ) {
        const cols = balanced(stmt, m[0].length - 1)!.inner;
        model.indexes.push({
          name: m[2]!.toLowerCase(),
          table: m[3]!.toLowerCase(),
          unique: m[1] !== undefined,
          columns: splitTop(cols).map((c) => c.replace(/"/g, "").trim()),
        });
      } else {
        model.unrecognized.push({ file, text: stmt });
      }
    }
  });
  return model;
}

/** Table privileges `role` ends up with after evaluating every grant and revoke in file order. */
export function netPrivileges(model: Model, table: string, role: string): Set<string> {
  const held = new Map<string, Set<string>>();
  const of = (r: string) => {
    if (!held.has(r)) held.set(r, new Set());
    return held.get(r)!;
  };
  for (const ev of model.tableGrants) {
    if (ev.table !== table) continue;
    const privileges = ev.privileges.flatMap((p) => (p === "all" ? ALL_PRIVILEGES : [p]));
    for (const r of ev.roles) {
      for (const p of privileges) {
        if (ev.action === "grant") of(r).add(p);
        else of(r).delete(p);
      }
    }
  }
  return new Set([...of(role), ...(role === "public" ? [] : of("public"))]);
}

/** Values of the `col in ('a', 'b')` check of a column, or null when there is none. */
export function enumValues(table: Table, column: string): string[] | null {
  const pattern = new RegExp(`(?:^|[\\s(])"?${column}"? in \\(((?:\\s*'[^']*'\\s*,?)+)\\)`, "i");
  for (const check of table.checks) {
    const m = pattern.exec(check);
    if (m !== null) return [...m[1]!.matchAll(/'([^']*)'/g)].map((v) => v[1]!);
  }
  return null;
}

/** Roles that can execute a function: Postgres grants execute to public until it is revoked. */
export function netExecute(model: Model, fn: string): Set<string> {
  const roles = new Set<string>(["public"]);
  for (const ev of model.functionGrants) {
    if (ev.fn !== fn) continue;
    const affectsExecute = ev.privileges.some((p) => p === "all" || p === "execute");
    if (!affectsExecute) continue;
    for (const r of ev.roles) {
      if (ev.action === "grant") roles.add(r);
      else roles.delete(r);
    }
  }
  return roles;
}
