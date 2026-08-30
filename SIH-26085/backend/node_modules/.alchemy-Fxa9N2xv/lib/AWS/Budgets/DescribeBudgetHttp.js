import * as budgets from "@distilled.cloud/aws/budgets";
import * as Layer from "effect/Layer";
import { makeBudgetHttpBinding } from "./BindingHttp.js";
import { DescribeBudget } from "./DescribeBudget.js";
export const DescribeBudgetHttp = Layer.effect(DescribeBudget, makeBudgetHttpBinding({
    tag: "AWS.Budgets.DescribeBudget",
    actions: ["budgets:ViewBudget"],
    operation: budgets.describeBudget,
}));
//# sourceMappingURL=DescribeBudgetHttp.js.map