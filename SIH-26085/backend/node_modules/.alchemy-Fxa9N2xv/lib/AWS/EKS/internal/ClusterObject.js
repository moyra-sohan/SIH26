/**
 * Internal helpers for binding Kubernetes objects onto an `AWS.EKS.Cluster`
 * through its `KubernetesObjectBinding` contract. The cluster's reconciler
 * server-side-applies every bound object after the control plane is ACTIVE.
 * Not exported from the EKS index — the public path for raw manifests is
 * `Kubernetes.Manifest`.
 */
import * as Effect from "effect/Effect";
import { kubernetesObjectKey, toKubernetesObjectRef, } from "../../../Kubernetes/internal/objects.js";
export const kubernetesBindingSid = (object) => `Kubernetes.Object(${kubernetesObjectKey(toKubernetesObjectRef(object))})`;
export const ClusterObject = Effect.fn(function* (id, props) {
    const object = {
        apiVersion: props.apiVersion,
        kind: props.kind,
        metadata: {
            name: props.metadata?.name ?? id,
            namespace: props.metadata?.namespace,
            labels: props.metadata?.labels,
            annotations: props.metadata?.annotations,
        },
        ...props.body,
    };
    yield* props.cluster.bind(kubernetesBindingSid(object), {
        type: "kubernetes-object",
        object,
    });
    const ref = toKubernetesObjectRef(object);
    return {
        cluster: props.cluster,
        apiVersion: ref.apiVersion,
        kind: ref.kind,
        name: ref.name,
        namespace: ref.namespace,
        key: kubernetesObjectKey(ref),
        object,
    };
});
export const namespaceNameOf = (namespace) => (typeof namespace === "string" ? namespace : namespace.name);
export const clusterServiceAccount = (id, props) => ClusterObject(id, {
    cluster: props.cluster,
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
        name: props.name,
        namespace: namespaceNameOf(props.namespace),
        labels: props.labels,
        annotations: props.annotations,
    },
});
//# sourceMappingURL=ClusterObject.js.map