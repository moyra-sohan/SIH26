import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix } from "../Connection/internal.js";
/**
 * Environment variable prefix under which {@link Connect} publishes the
 * cluster endpoint on the host Function, derived from the cluster's logical
 * ID. A cluster with logical ID `SessionStore` yields `MEMORYDB_SESSIONSTORE`
 * and the variables `MEMORYDB_SESSIONSTORE_HOST`,
 * `MEMORYDB_SESSIONSTORE_PORT`, and `MEMORYDB_SESSIONSTORE_TLS`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("MEMORYDB", logicalId);
export const Connect = Binding.Service("AWS.MemoryDB.Connect");
//# sourceMappingURL=Connect.js.map