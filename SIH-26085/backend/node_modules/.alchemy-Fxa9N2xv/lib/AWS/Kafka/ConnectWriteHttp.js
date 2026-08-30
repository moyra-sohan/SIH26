import * as Layer from "effect/Layer";
import { ConnectWrite } from "./Connect.js";
import { KAFKA_CONNECT_ACTIONS, KAFKA_WRITE_CLUSTER_ACTIONS, KAFKA_WRITE_TOPIC_ACTIONS, KAFKA_WRITE_TRANSACTION_ACTIONS, makeKafkaConnectHttpBinding, } from "./ConnectHttp.js";
export const ConnectWriteHttp = Layer.effect(ConnectWrite, makeKafkaConnectHttpBinding({
    tag: "AWS.Kafka.ConnectWrite",
    clusterActions: [...KAFKA_CONNECT_ACTIONS, ...KAFKA_WRITE_CLUSTER_ACTIONS],
    topicActions: KAFKA_WRITE_TOPIC_ACTIONS,
    transactionActions: KAFKA_WRITE_TRANSACTION_ACTIONS,
}));
//# sourceMappingURL=ConnectWriteHttp.js.map