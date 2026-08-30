import * as medicalimaging from "@distilled.cloud/aws/medical-imaging";
import * as Layer from "effect/Layer";
import { makeMedicalImagingDatastoreHttpBinding } from "./BindingHttp.js";
import { DeleteImageSet } from "./DeleteImageSet.js";
export const DeleteImageSetHttp = Layer.effect(DeleteImageSet, makeMedicalImagingDatastoreHttpBinding({
    tag: "AWS.MedicalImaging.DeleteImageSet",
    operation: medicalimaging.deleteImageSet,
    actions: ["medical-imaging:DeleteImageSet"],
}));
//# sourceMappingURL=DeleteImageSetHttp.js.map