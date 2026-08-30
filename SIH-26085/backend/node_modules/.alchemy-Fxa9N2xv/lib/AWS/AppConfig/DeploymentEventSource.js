import * as Binding from "../../Binding.js";
export function consumeDeploymentEvents(target, propsOrProcess, maybeProcess) {
    const [props, process] = typeof propsOrProcess === "function"
        ? [{}, propsOrProcess]
        : [propsOrProcess, maybeProcess];
    return DeploymentEventSource.use((source) => source(target, props, process));
}
export const DeploymentEventSource = Binding.Service("AWS.AppConfig.DeploymentEventSource");
//# sourceMappingURL=DeploymentEventSource.js.map