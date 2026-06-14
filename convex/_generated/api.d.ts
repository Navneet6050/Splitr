/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as balances from "../balances.js";
import type * as contacts from "../contacts.js";
import type * as currency from "../currency.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as expenses from "../expenses.js";
import type * as groups from "../groups.js";
import type * as import_detectors_aliasDetector from "../import/detectors/aliasDetector.js";
import type * as import_detectors_amountDetector from "../import/detectors/amountDetector.js";
import type * as import_detectors_currencyDetector from "../import/detectors/currencyDetector.js";
import type * as import_detectors_dateFormatDetector from "../import/detectors/dateFormatDetector.js";
import type * as import_detectors_duplicateDetector from "../import/detectors/duplicateDetector.js";
import type * as import_detectors_index from "../import/detectors/index.js";
import type * as import_detectors_membershipDetector from "../import/detectors/membershipDetector.js";
import type * as import_detectors_participantDetector from "../import/detectors/participantDetector.js";
import type * as import_detectors_splitTypeDetector from "../import/detectors/splitTypeDetector.js";
import type * as imports from "../imports.js";
import type * as inngest from "../inngest.js";
import type * as memberships from "../memberships.js";
import type * as seed from "../seed.js";
import type * as settlements from "../settlements.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  balances: typeof balances;
  contacts: typeof contacts;
  currency: typeof currency;
  dashboard: typeof dashboard;
  email: typeof email;
  expenses: typeof expenses;
  groups: typeof groups;
  "import/detectors/aliasDetector": typeof import_detectors_aliasDetector;
  "import/detectors/amountDetector": typeof import_detectors_amountDetector;
  "import/detectors/currencyDetector": typeof import_detectors_currencyDetector;
  "import/detectors/dateFormatDetector": typeof import_detectors_dateFormatDetector;
  "import/detectors/duplicateDetector": typeof import_detectors_duplicateDetector;
  "import/detectors/index": typeof import_detectors_index;
  "import/detectors/membershipDetector": typeof import_detectors_membershipDetector;
  "import/detectors/participantDetector": typeof import_detectors_participantDetector;
  "import/detectors/splitTypeDetector": typeof import_detectors_splitTypeDetector;
  imports: typeof imports;
  inngest: typeof inngest;
  memberships: typeof memberships;
  seed: typeof seed;
  settlements: typeof settlements;
  users: typeof users;
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
