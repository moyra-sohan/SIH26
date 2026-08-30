import * as budgets from "@distilled.cloud/aws/budgets";
import * as Layer from "effect/Layer";
import { makeBudgetHttpBinding } from "./BindingHttp.js";
import { DescribeBudgetPerformanceHistory } from "./DescribeBudgetPerformanceHistory.js";
export const DescribeBudgetPerformanceHistoryHttp = Layer.effect(DescribeBudgetPerformanceHistory, makeBudgetHttpBinding({
    tag: "AWS.Budgets.DescribeBudgetPerformanceHistory",
    actions: ["budgets:ViewBudget"],
    operation: budgets.describeBudgetPerformanceHistory,
}));
//# sourceMappingURL=DescribeBudgetPerformanceHistoryHttp.js.map