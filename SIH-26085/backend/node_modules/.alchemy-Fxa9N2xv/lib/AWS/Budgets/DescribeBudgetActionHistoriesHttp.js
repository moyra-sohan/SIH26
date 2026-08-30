import * as budgets from "@distilled.cloud/aws/budgets";
import * as Layer from "effect/Layer";
import { makeBudgetActionHttpBinding } from "./BindingHttp.js";
import { DescribeBudgetActionHistories } from "./DescribeBudgetActionHistories.js";
export const DescribeBudgetActionHistoriesHttp = Layer.effect(DescribeBudgetActionHistories, makeBudgetActionHttpBinding({
    tag: "AWS.Budgets.DescribeBudgetActionHistories",
    actions: ["budgets:DescribeBudgetActionHistories"],
    operation: budgets.describeBudgetActionHistories,
}));
//# sourceMappingURL=DescribeBudgetActionHistoriesHttp.js.map