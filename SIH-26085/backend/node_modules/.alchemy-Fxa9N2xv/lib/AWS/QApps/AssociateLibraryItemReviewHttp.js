import * as qapps from "@distilled.cloud/aws/qapps";
import * as Layer from "effect/Layer";
import { makeQAppsInstanceHttpBinding } from "./BindingHttp.js";
import { AssociateLibraryItemReview } from "./AssociateLibraryItemReview.js";
export const AssociateLibraryItemReviewHttp = Layer.effect(AssociateLibraryItemReview, makeQAppsInstanceHttpBinding({
    capability: "AssociateLibraryItemReview",
    iamActions: ["qapps:AssociateLibraryItemReview"],
    operation: qapps.associateLibraryItemReview,
}));
//# sourceMappingURL=AssociateLibraryItemReviewHttp.js.map