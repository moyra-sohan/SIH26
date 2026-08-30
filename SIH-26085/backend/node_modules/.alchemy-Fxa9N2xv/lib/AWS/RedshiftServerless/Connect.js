import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix, } from "../Connection/internal.js";
/**
 * Environment variable prefix under which {@link Connect} publishes the
 * workgroup endpoint on the host Function, derived from the workgroup's
 * logical ID. A workgroup with logical ID `Analytics` yields
 * `REDSHIFT_SERVERLESS_ANALYTICS` and the variables
 * `REDSHIFT_SERVERLESS_ANALYTICS_HOST` /
 * `REDSHIFT_SERVERLESS_ANALYTICS_PORT`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("REDSHIFT_SERVERLESS", logicalId);
export const Connect = Binding.Service("AWS.RedshiftServerless.Connect");
//# sourceMappingURL=Connect.js.map