import * as Binding from "../../Binding.js";
import { connectEnvPrefix as makeConnectEnvPrefix } from "../Connection/internal.js";
/**
 * Environment variable prefix under which the connect bindings publish the
 * cluster endpoint on the host Function, derived from the cluster's logical
 * ID. A cluster with logical ID `Events` yields `MSK_EVENTS` and the
 * variables `MSK_EVENTS_BROKERS` and `MSK_EVENTS_ARN`.
 */
export const connectEnvPrefix = (logicalId) => makeConnectEnvPrefix("MSK", logicalId);
export const ConnectRead = Binding.Service("AWS.Kafka.ConnectRead");
export const ConnectWrite = Binding.Service("AWS.Kafka.ConnectWrite");
export const ConnectReadWrite = Binding.Service("AWS.Kafka.ConnectReadWrite");
//# sourceMappingURL=Connect.js.map