// Offline stand-in for `npx convex codegen` so CI can typecheck/test without a
// Convex deployment. Real codegen (with CONVEX_DEPLOY_KEY) should replace this.
import { mkdirSync, writeFileSync } from "node:fs";
const dir = new URL("../src/convex/_generated/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("dataModel.ts", dir), `import type { DataModelFromSchemaDefinition, DocumentByName, TableNamesInDataModel } from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema";
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<T extends TableNames> = DocumentByName<DataModel, T>;
export type Id<T extends TableNames> = GenericId<T>;
`);
writeFileSync(new URL("server.ts", dir), `import { actionGeneric, internalActionGeneric, internalMutationGeneric, internalQueryGeneric, mutationGeneric, queryGeneric, type ActionBuilder, type MutationBuilder, type QueryBuilder } from "convex/server";
import type { DataModel } from "./dataModel";
export const query = queryGeneric as QueryBuilder<DataModel, "public">;
export const mutation = mutationGeneric as MutationBuilder<DataModel, "public">;
export const action = actionGeneric as ActionBuilder<DataModel, "public">;
export const internalQuery = internalQueryGeneric as QueryBuilder<DataModel, "internal">;
export const internalMutation = internalMutationGeneric as MutationBuilder<DataModel, "internal">;
export const internalAction = internalActionGeneric as ActionBuilder<DataModel, "internal">;
`);
writeFileSync(new URL("api.ts", dir), `import { anyApi } from "convex/server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api = anyApi as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const internal = anyApi as any;
`);
console.log("Generated src/convex/_generated/ stub.");
