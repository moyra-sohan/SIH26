import * as featurestore from "@distilled.cloud/aws/sagemaker-featurestore-runtime";
import * as Layer from "effect/Layer";
import { makeFeatureGroupHttpBinding } from "./BindingHttp.js";
import { DeleteRecord } from "./DeleteRecord.js";
export const DeleteRecordHttp = Layer.effect(DeleteRecord, makeFeatureGroupHttpBinding({
    tag: "AWS.SageMaker.DeleteRecord",
    operation: featurestore.deleteRecord,
    actions: ["sagemaker:DeleteRecord"],
    prepare: (request, featureGroupName) => ({
        ...request,
        FeatureGroupName: featureGroupName,
    }),
}));
//# sourceMappingURL=DeleteRecordHttp.js.map