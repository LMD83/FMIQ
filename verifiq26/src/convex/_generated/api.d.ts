/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_classify from "../actions/classify.js";
import type * as actions_coordinate from "../actions/coordinate.js";
import type * as actions_scan from "../actions/scan.js";
import type * as actions_uploads from "../actions/uploads.js";
import type * as lib_anthropicClient from "../lib/anthropicClient.js";
import type * as lib_corpus from "../lib/corpus.js";
import type * as lib_extract from "../lib/extract.js";
import type * as lib_sourceQuote from "../lib/sourceQuote.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/classify": typeof actions_classify;
  "actions/coordinate": typeof actions_coordinate;
  "actions/scan": typeof actions_scan;
  "actions/uploads": typeof actions_uploads;
  "lib/anthropicClient": typeof lib_anthropicClient;
  "lib/corpus": typeof lib_corpus;
  "lib/extract": typeof lib_extract;
  "lib/sourceQuote": typeof lib_sourceQuote;
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
