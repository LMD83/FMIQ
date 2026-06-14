/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_dto from "../lib/dto.js";
import type * as lib_guards from "../lib/guards.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as matches from "../matches.js";
import type * as messages from "../messages.js";
import type * as metrics from "../metrics.js";
import type * as moderation from "../moderation.js";
import type * as needs from "../needs.js";
import type * as offers from "../offers.js";
import type * as orgs from "../orgs.js";
import type * as registerLookup from "../registerLookup.js";
import type * as retention from "../retention.js";
import type * as seed from "../seed.js";
import type * as smoke from "../smoke.js";
import type * as users from "../users.js";
import type * as vault from "../vault.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  "lib/dto": typeof lib_dto;
  "lib/guards": typeof lib_guards;
  "lib/rbac": typeof lib_rbac;
  matches: typeof matches;
  messages: typeof messages;
  metrics: typeof metrics;
  moderation: typeof moderation;
  needs: typeof needs;
  offers: typeof offers;
  orgs: typeof orgs;
  registerLookup: typeof registerLookup;
  retention: typeof retention;
  seed: typeof seed;
  smoke: typeof smoke;
  users: typeof users;
  vault: typeof vault;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
