/**
 * The cluster-agnostic Kubernetes connection model.
 *
 * Every `Kubernetes.*` workload (`Deployment`, `Job`, `Manifest`,
 * `HelmChart`) targets a cluster through a serializable {@link Connection}:
 * the API server endpoint (or enough information to discover it) plus an
 * {@link ConnectionAuth} descriptor whose `kind` selects the
 * {@link ClusterAdapter} that knows how to authenticate requests — and,
 * for managed clouds, how to provision workload identity and container
 * images.
 *
 * A `Connection` is plain data on purpose: it is resolved from resource
 * attributes at reconcile time and persisted on workload attributes so
 * `delete` can reconnect without the original resource graph.
 */
const isConnection = (value) => "auth" in value && value.auth !== undefined;
/**
 * Normalize a {@link ClusterLike} to its {@link Connection}. Throws when
 * the value carries neither shape — e.g. a managed cluster resource whose
 * attributes predate the `connection` field.
 */
export const toConnection = (cluster) => {
    if (isConnection(cluster))
        return cluster;
    if (cluster.connection !== undefined)
        return cluster.connection;
    throw new Error("The `cluster` value carries no Kubernetes connection. Pass a cluster " +
        "resource whose attributes expose `connection` (e.g. `AWS.EKS.Cluster`" +
        " — redeploy the cluster if it was created before the `connection` " +
        "attribute existed), a `Kubernetes.KubeConfig(...)`, or a raw " +
        "`Kubernetes.Connection`.");
};
/**
 * Connect `Kubernetes.*` workloads to any cluster your local kubeconfig can
 * reach — k3s, kind, on-prem, AKS, GKE, anything `kubectl` works against.
 * Exec credential plugins declared in the file (`aws eks get-token`,
 * `kubelogin`, `gke-gcloud-auth-plugin`) are honored, so cloud-CLI-managed
 * contexts work as-is.
 *
 * This is a plain helper, not a resource: nothing is provisioned and the
 * cluster appears in no plan — it only describes how to reach the API
 * server.
 *
 * ```ts
 * const cluster = Kubernetes.KubeConfig({ context: "prod-east" });
 *
 * const api = yield* Kubernetes.Deployment("Api", {
 *   cluster,
 *   image: "ghcr.io/acme/api:v3",
 *   port: 8080,
 * });
 * ```
 */
export const KubeConfig = (options) => ({
    auth: {
        kind: "kubeconfig",
        path: options?.path,
        context: options?.context,
    },
});
//# sourceMappingURL=Connection.js.map