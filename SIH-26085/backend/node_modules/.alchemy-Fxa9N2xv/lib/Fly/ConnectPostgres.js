import * as Data from "effect/Data";
import * as Binding from "../Binding.js";
export const ConnectPostgres = Binding.Service("Fly.ConnectPostgres");
export const connectEnvKeys = (postgres) => {
    const id = postgres.LogicalId.replaceAll(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    return {
        pooled: `FLY_POSTGRES_${id}_POOLED`,
        direct: `FLY_POSTGRES_${id}_DIRECT`,
    };
};
export class PostgresUrlMissing extends Data.TaggedError("Fly.PostgresUrlMissing") {
}
//# sourceMappingURL=ConnectPostgres.js.map