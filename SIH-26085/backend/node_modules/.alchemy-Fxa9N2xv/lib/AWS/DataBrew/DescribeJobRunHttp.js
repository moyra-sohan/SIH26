import * as databrew from "@distilled.cloud/aws/databrew";
import * as Layer from "effect/Layer";
import { makeDataBrewJobHttpBinding } from "./BindingHttp.js";
import { DescribeJobRun } from "./DescribeJobRun.js";
export const DescribeJobRunHttp = Layer.effect(DescribeJobRun, makeDataBrewJobHttpBinding({
    tag: "AWS.DataBrew.DescribeJobRun",
    operation: databrew.describeJobRun,
    actions: ["databrew:DescribeJobRun"],
}));
//# sourceMappingURL=DescribeJobRunHttp.js.map