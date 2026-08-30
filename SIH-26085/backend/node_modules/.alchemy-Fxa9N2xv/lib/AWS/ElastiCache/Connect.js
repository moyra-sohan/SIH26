import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix } from "../Connection/internal.js";
/**
 * Environment variable prefix under which {@link Connect} publishes the
 * cache endpoint on the host Function, derived from the cache's logical ID.
 * A cache with logical ID `SessionCache` yields `ELASTICACHE_SESSIONCACHE`
 * and the variables `ELASTICACHE_SESSIONCACHE_HOST`,
 * `ELASTICACHE_SESSIONCACHE_PORT`, and `ELASTICACHE_SESSIONCACHE_TLS`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("ELASTICACHE", logicalId);
export const Connect = Binding.Service("AWS.ElastiCache.Connect");
//# sourceMappingURL=Connect.js.map