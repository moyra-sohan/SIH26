/**
 * Typed view of the Axiom dashboard chart-JSON subset.
 *
 * Axiom's `CreateDashboardInput` declares
 * `dashboard.charts: ReadonlyArray<unknown>` (see
 * `@distilled.cloud/axiom/.../v2/createDashboard.ts`); these
 * interfaces give callers compile-time safety when building the
 * payload by hand.
 *
 * `chart.id` is a free-form string the author picks — Axiom
 * doesn't validate the format. It joins to the matching
 * `LayoutCell.i` in `dashboard.layout`.
 */
//# sourceMappingURL=Chart.js.map