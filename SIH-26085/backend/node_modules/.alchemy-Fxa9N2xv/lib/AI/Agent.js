import * as Effect from "effect/Effect";
import { effectClass } from "../Util/effect.js";
export const Agent = ((name) => name
    ? (template, ...refs) => makeAgent(name, template, refs)
    : (name) => (template, ...refs) => makeAgent(name, template, refs));
const makeAgent = (name, template, refs) => Object.assign(effectClass(Effect.gen(function* () {
    // TODO(sam): implement the agent
})), {
    "~alchemy/Kind": "Agent",
    "~alchemy/Name": name,
    refs,
    template,
});
//# sourceMappingURL=Agent.js.map