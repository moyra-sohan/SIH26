import * as Containers from "@distilled.cloud/cloudflare/containers";
import * as Redacted from "effect/Redacted";
import * as ProviderLayer from "../../Local/ProviderLayer.js";
import {} from "../../Platform.js";
import { Resource } from "../../Resource.js";
import * as Server from "../../Server/index.js";
import { ContainerTypeId } from "./Container.js";
import { LiveContainerProvider } from "./ContainerProvider.js";
import { LocalContainerProvider } from "./LocalContainerProvider.js";
export { Credentials } from "@distilled.cloud/cloudflare/Credentials";
export const ContainerProvider = () => 
// `{ Type }` instead of `ContainerPlatform` — importing the platform here
// would create a module cycle (ContainerPlatform.ts imports this file).
ProviderLayer.dual({ Type: ContainerTypeId }, {
    live: () => LiveContainerProvider(),
    local: () => LocalContainerProvider(),
});
//# sourceMappingURL=ContainerApplication.js.map