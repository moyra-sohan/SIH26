import * as Effect from "effect/Effect";
import { AlchemyContext } from "./AlchemyContext.js";
import * as Apply from "./Apply.js";
import * as Plan from "./Plan.js";
import { evalStack } from "./Stack.js";
import { Stage } from "./Stage.js";
export const deploy = ({ stack, stage, dev, scope, force, }) => evalStack(stack, (stack) => Effect.gen(function* () {
    const plan = yield* Plan.make(stack, { force });
    const output = yield* Apply.apply(plan);
    return output;
}), { stage, dev, scope });
//# sourceMappingURL=Deploy.js.map