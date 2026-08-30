import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix, } from "../Connection/internal.js";
/**
 * Environment variable prefix under which {@link Connect} publishes the
 * cluster endpoint on the host Function, derived from the cluster's logical
 * ID. A cluster with logical ID `Analytics` yields `REDSHIFT_ANALYTICS` and
 * the variables `REDSHIFT_ANALYTICS_HOST` / `REDSHIFT_ANALYTICS_PORT`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("REDSHIFT", logicalId);
export const Connect = Binding.Service("AWS.Redshift.Connect");
//# sourceMappingURL=Connect.js.map