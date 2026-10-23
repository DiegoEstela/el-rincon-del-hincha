// Which input the CLI reads (plan 0017, T8): --from, else --network, else the default directory
// of the adapter, else the generic network loader. Pure apart from building loaders.
import { resolve } from "node:path";
import { directoryLoader, networkLoader, type Adapter, type SourceLoader } from "./core/adapter";

export type LoaderFlags = { from?: string; network: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function chooseLoader(adapter: Adapter<any>, flags: LoaderFlags): SourceLoader {
  if (flags.from !== undefined && flags.network) {
    throw new Error("--from and --network cannot be used together");
  }
  if (flags.from !== undefined) return directoryLoader(flags.from);
  if (flags.network) return adapter.networkLoader ?? networkLoader;
  if (adapter.defaultInputDir !== undefined)
    return directoryLoader(resolve(adapter.defaultInputDir));
  return adapter.networkLoader ?? networkLoader;
}
