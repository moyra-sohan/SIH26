import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix } from "../Connection/internal.js";
/**
 * Environment variable prefix under which the connect bindings publish the
 * cluster endpoint on the host Function, derived from the cluster's logical
 * ID. A cluster with logical ID `Cache` yields `DAX_CACHE` and the variables
 * `DAX_CACHE_HOST`, `DAX_CACHE_PORT`, `DAX_CACHE_URL`, and `DAX_CACHE_TLS`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("DAX", logicalId);
export const ConnectRead = Binding.Service("AWS.DAX.ConnectRead");
export const ConnectWrite = Binding.Service("AWS.DAX.ConnectWrite");
export const ConnectReadWrite = Binding.Service("AWS.DAX.ConnectReadWrite");
//# sourceMappingURL=Connect.js.map