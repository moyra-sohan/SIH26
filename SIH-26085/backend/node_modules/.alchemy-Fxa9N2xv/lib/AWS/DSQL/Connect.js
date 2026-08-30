import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix } from "../Connection/internal.js";
/**
 * Environment variable prefix under which {@link Connect} publishes the
 * cluster endpoint on the host Function, derived from the cluster's logical
 * ID. A cluster with logical ID `AppDb` yields `DSQL_APPDB` and the variable
 * `DSQL_APPDB_HOST`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("DSQL", logicalId);
export const Connect = Binding.Service("AWS.DSQL.Connect");
//# sourceMappingURL=Connect.js.map