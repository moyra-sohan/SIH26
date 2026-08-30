import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { BucketEventSource } from "./BucketEventSource.js";
export function consumeBucketEvents(bucket, propsOrHandler, maybeHandler) {
    const props = typeof propsOrHandler === "function" ? {} : propsOrHandler;
    const handler = typeof propsOrHandler === "function" ? propsOrHandler : maybeHandler;
    return BucketEventSource.use((source) => source(bucket, props, handler));
}
//# sourceMappingURL=BucketNotifications.js.map