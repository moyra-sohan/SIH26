import * as cloudwatch from "@distilled.cloud/aws/cloudwatch";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isResolved } from "../../Diff.js";
import * as Provider from "../../Provider.js";
import { Resource } from "../../Resource.js";
import { AWSEnvironment } from "../Environment.js";
import { createName, retryConcurrent } from "./common.js";
/**
 * An Amazon CloudWatch dashboard. The `DashboardBody` is a structured,
 * typed document (metric, text, alarm-status, and log widgets) that the
 * provider serializes to the JSON string CloudWatch expects.
 * ### Creating Dashboards
 * **Example:** Basic Dashboard
 * ```typescript
 * const dashboard = yield* Dashboard("OpsDashboard", {
 *   DashboardBody: {
 *     widgets: [],
 *   },
 * });
 * ```
 *
 * **Example:** Dashboard with Metric and Text Widgets
 * ```typescript
 * const dashboard = yield* Dashboard("PaymentsDashboard", {
 *   DashboardBody: {
 *     widgets: [
 *       {
 *         type: "text",
 *         x: 0, y: 0, width: 6, height: 3,
 *         properties: { markdown: "# Payments service" },
 *       },
 *       {
 *         type: "metric",
 *         x: 0, y: 3, width: 12, height: 6,
 *         properties: {
 *           title: "Payments processed",
 *           metrics: [["MyApp/Payments", "PaymentProcessed"]],
 *           stat: "Sum",
 *           period: 60,
 *           view: "timeSeries",
 *         },
 *       },
 *     ],
 *   },
 * });
 * ```
 *
 * ### Reading Dashboards at Runtime
 * **Example:** Read the Dashboard Body from a Function
 * ```typescript
 * // init — bind the dashboard to the function (see GetDashboard)
 * const getDashboard = yield* AWS.CloudWatch.GetDashboard(dashboard);
 *
 * // runtime
 * const result = yield* getDashboard();
 * const body = JSON.parse(result.DashboardBody ?? "{}");
 * ```
 *
 * @resource
 */
export const Dashboard = Resource("AWS.CloudWatch.Dashboard");
const serializeDashboardBody = (body) => JSON.stringify(body);
const parseDashboardBody = (body) => {
    if (!body) {
        return undefined;
    }
    return JSON.parse(body);
};
export const DashboardProvider = () => Provider.effect(Dashboard, Effect.gen(function* () {
    const createDashboardName = (id, props = {}) => createName(id, props.name, 255);
    const dashboardArn = (dashboardName) => AWSEnvironment.current.pipe(Effect.map((env) => `arn:aws:cloudwatch::${env.accountId}:dashboard/${dashboardName}`));
    const readDashboard = Effect.fn(function* (dashboardName) {
        const output = yield* cloudwatch
            .getDashboard({
            DashboardName: dashboardName,
        })
            .pipe(Effect.catchTag("DashboardNotFoundError", () => Effect.succeed(undefined)));
        if (!output?.DashboardName) {
            return undefined;
        }
        return {
            dashboardName: output.DashboardName,
            dashboardArn: yield* dashboardArn(output.DashboardName),
            dashboardBody: parseDashboardBody(output.DashboardBody),
            tags: {},
        };
    });
    return {
        stables: ["dashboardName", "dashboardArn"],
        diff: Effect.fn(function* ({ id, olds = {}, news = {}, }) {
            if (!isResolved(news))
                return undefined;
            const oldName = yield* createDashboardName(id, olds);
            const newName = yield* createDashboardName(id, news);
            if (oldName !== newName) {
                return { action: "replace" };
            }
        }),
        read: Effect.fn(function* ({ id, olds, output }) {
            const name = output?.dashboardName ??
                (yield* createDashboardName(id, olds ?? {}));
            return yield* readDashboard(name);
        }),
        reconcile: Effect.fn(function* ({ id, news, output, session }) {
            // Observe — pin the physical name from `output` if present so we
            // never rename an existing dashboard; otherwise derive from
            // desired props.
            const name = output?.dashboardName ?? (yield* createDashboardName(id, news));
            // Ensure — `putDashboard` is a pure upsert. The CloudWatch
            // dashboard API has no separate update path, so we always send
            // the full body and let the API converge.
            yield* retryConcurrent(cloudwatch.putDashboard({
                DashboardName: name,
                DashboardBody: serializeDashboardBody(news.DashboardBody),
            }));
            yield* session.note(yield* dashboardArn(name));
            const state = yield* readDashboard(name);
            if (!state) {
                return yield* Effect.fail(new Error(`failed to read reconciled dashboard '${name}'`));
            }
            // Dashboards do not support the generic CloudWatch tagging APIs,
            // so `tags` is always returned as an empty record.
            return {
                ...state,
                tags: {},
            };
        }),
        delete: Effect.fn(function* ({ output }) {
            // `DeleteDashboards` is idempotent: AWS returns success (not
            // `DashboardNotFoundError`) for names that don't exist, so a
            // re-delete after a state-persistence failure is a safe no-op.
            yield* retryConcurrent(cloudwatch.deleteDashboards({
                DashboardNames: [output.dashboardName],
            }));
        }),
        list: () => Effect.gen(function* () {
            // `listDashboards` only returns entry metadata (name/arn/size),
            // not the body, so we re-read each dashboard to produce the full
            // Attributes shape `read` returns.
            const names = yield* cloudwatch.listDashboards.pages({}).pipe(Stream.runCollect, Effect.map((chunk) => Array.from(chunk).flatMap((page) => (page.DashboardEntries ?? [])
                .map((entry) => entry.DashboardName)
                .filter((name) => name != null))));
            const states = yield* Effect.forEach(names, (name) => readDashboard(name), { concurrency: 10 });
            return states.filter((state) => state !== undefined);
        }),
    };
}));
//# sourceMappingURL=Dashboard.js.map