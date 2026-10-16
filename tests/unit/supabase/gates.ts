import { netExecute, netPrivileges, type Model } from "./sql-model";

const CLIENT_ROLES = ["anon", "authenticated", "public"];

/** Everything the plan 0006 security gate forbids, as human-readable lines. Empty means safe. */
export function securityViolations(model: Model): string[] {
  const out: string[] = [];
  for (const table of model.tables.values()) {
    const rlsFile = model.rls.get(table.name);
    if (rlsFile === undefined) out.push(`${table.name}: row level security is never enabled`);
    else if (rlsFile !== table.file) {
      out.push(`${table.name}: RLS is enabled in a different file than the one creating it`);
    }
    if (table.primaryKey.length === 0) out.push(`${table.name}: no primary key`);
    for (const role of CLIENT_ROLES) {
      const extra = [...netPrivileges(model, table.name, role)].filter((p) => p !== "select");
      if (extra.length > 0) out.push(`${table.name}: ${role} keeps ${extra.join(", ")}`);
    }
  }
  for (const policy of model.policies) {
    const exposed = policy.roles.filter((r) => CLIENT_ROLES.includes(r));
    if (policy.command !== "select" && exposed.length > 0) {
      out.push(
        `${policy.table}: policy ${policy.name} lets ${exposed.join(", ")} ${policy.command}`,
      );
    }
    if (policy.roles.includes("public")) {
      out.push(`${policy.table}: policy ${policy.name} has no explicit "to" role list`);
    }
  }
  for (const fn of model.functions.values()) {
    if (fn.securityDefiner && fn.searchPath !== "") {
      out.push(`${fn.name}: security definer without set search_path = ''`);
    }
    if (fn.securityDefiner) {
      const exposed = [...netExecute(model, fn.name)].filter((r) => CLIENT_ROLES.includes(r));
      if (exposed.length > 0) {
        out.push(`${fn.name}: security definer function executable by ${exposed.join(", ")}`);
      }
    }
  }
  return out;
}
