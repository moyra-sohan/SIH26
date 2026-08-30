import { consumeBusEvents, } from "../EventBridge/EventSource.js";
const DETAIL_TYPES = {
    issuance: "ACM Private CA Certificate Issuance",
    revocation: "ACM Private CA Certificate Revocation",
    crl: "ACM Private CA CRL Generation",
    auditReport: "ACM Private CA Audit Report Generation",
};
/**
 * Event source connecting AWS Private CA notifications to the hosting
 * compute. AWS Private CA publishes certificate issuance/revocation, CRL
 * generation, and audit report completion to the account's default
 * EventBridge bus (source `aws.acm-pca`); this subscribes the host Function
 * to those events so it can distribute freshly issued certificates, alert
 * on revocations, or track CRL/audit failures.
 *
 * AWS Private CA publishes to EventBridge automatically — no additional
 * resource is created besides the EventBridge rule targeting the host.
 * Provide the host-specific implementation layer (e.g.
 * `AWS.Lambda.EventSource`) on the Function effect.
 *
 * Success events carry the CA ARN and the certificate (or audit report)
 * ARN in the event's top-level `resources` array; `detail` is empty.
 * Failure events set `detail.result` to `"failure"`.
 *
 * ### Consuming Certificate Authority Events
 * **Example:** React To Issued Certificates
 * ```typescript
 * import * as AWS from "alchemy/AWS";
 *
 * export default CertFunction.make(
 *   { main: import.meta.url },
 *   Effect.gen(function* () {
 *     yield* AWS.ACMPCA.consumeCertificateAuthorityEvents(
 *       { kinds: ["issuance", "revocation"] },
 *       (events) =>
 *         Stream.runForEach(events, (event) =>
 *           Effect.log(`${event["detail-type"]}: ${event.resources[1]}`),
 *         ),
 *     );
 *     return {};
 *   }).pipe(Effect.provide(AWS.Lambda.EventSource)),
 * );
 * ```
 */
export const consumeCertificateAuthorityEvents = (props, process) => consumeBusEvents(props.id ?? "ACMPCAEvents", {
    source: ["aws.acm-pca"],
    "detail-type": (props.kinds ?? ["issuance"]).map((kind) => DETAIL_TYPES[kind]),
    ...(props.certificateAuthorityArns !== undefined
        ? { resources: [...props.certificateAuthorityArns] }
        : {}),
}, { description: props.description, state: props.state }, process);
//# sourceMappingURL=CertificateAuthorityEventSource.js.map