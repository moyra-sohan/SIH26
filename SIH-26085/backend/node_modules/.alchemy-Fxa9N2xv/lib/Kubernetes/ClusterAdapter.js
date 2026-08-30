/**
 * The extension seam between the cluster-agnostic `Kubernetes.*` workloads
 * and the platform a cluster runs on.
 *
 * A {@link ClusterAdapterService} is registered under a keyed Context tag —
 * `Kubernetes.ClusterAdapter/<auth kind>` — and resolved dynamically from
 * the ambient provider context by {@link findClusterAdapter}, mirroring how
 * resource providers are resolved by type. `Kubernetes.providers()` ships
 * the built-in adapters (`kubeconfig`, `token`, `client-cert`, `exec`);
 * cloud provider layers contribute theirs (`AWS.providers()` registers
 * `aws-eks`).
 *
 * An adapter owns everything platform-specific:
 *
 * - **connect** (required) — resolve the API server endpoint/CA and mint
 *   per-request auth headers.
 * - **identity** (optional) — provision workload identity for a namespace +
 *   service account and translate host bindings into cloud credentials
 *   (EKS Pod Identity; Azure Workload Identity would slot in here).
 * - **registry** (optional) — build/mirror container images into a managed
 *   registry the cluster can pull from (ECR on EKS).
 * - **bootstrap** (optional) — platform-specific generated container
 *   entries for Effect-native workloads (e.g. wiring the AWS credential
 *   chain for Pod Identity).
 * - **loadBalancerDefaults** (optional) — platform defaults for
 *   `LoadBalancer` Services (EKS Auto Mode's `loadBalancerClass` +
 *   internet-facing scheme).
 */
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
/**
 * The target cluster no longer exists (definitively — e.g. the managed
 * control plane is deleted or deleting). Distinct from transient
 * unreachability: `read`/`delete` treat this as "everything in-cluster is
 * already gone".
 */
export class ClusterNotFoundError extends Data.TaggedError("Kubernetes.ClusterNotFoundError") {
}
const adapterKey = (authKind) => `Kubernetes.ClusterAdapter/${authKind}`;
/**
 * The keyed Context tag for an adapter. Same auth kind → same tag, so a
 * layer built with `ClusterAdapter("aws-eks")` is found by any dynamic
 * lookup for that kind.
 */
export const ClusterAdapter = (authKind) => Context.Service()(adapterKey(authKind));
/**
 * Resolve the {@link ClusterAdapterService} for a connection's auth kind
 * from the ambient context (the stack's composed provider layers). Dies
 * with setup guidance when no adapter is registered — that means the
 * provider layer contributing it (e.g. `AWS.providers()` for `aws-eks`)
 * is missing from the stack.
 */
export const findClusterAdapter = (authKind) => Effect.serviceOption(ClusterAdapter(authKind)).pipe(Effect.flatMap(Option.match({
    onSome: (adapter) => Effect.succeed(adapter),
    onNone: () => Effect.die(new Error(`No Kubernetes cluster adapter is registered for auth kind ` +
        `'${authKind}'. Add the provider layer that contributes it ` +
        `to the stack's providers — e.g. 'aws-eks' ships with ` +
        "`AWS.providers()`; the built-in kinds (kubeconfig, token, " +
        "client-cert, exec) ship with `Kubernetes.providers()`. " +
        "Compose multiple provider layers with " +
        "`Layer.mergeAll(AWS.providers(), Kubernetes.providers())`.")),
})));
//# sourceMappingURL=ClusterAdapter.js.map