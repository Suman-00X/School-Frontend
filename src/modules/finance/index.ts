import { createElement } from "react";
import type { RouteObject } from "react-router-dom";
import { SetupLayout } from "./shared";
import { routes as feeHeadRoutes } from "./fee-heads";
import { routes as installmentPlanRoutes } from "./installment-plans";
import { routes as lateFeeRuleRoutes } from "./late-fee-rules";
import { routes as concessionRoutes } from "./concessions";
import { routes as financeSettingsRoutes } from "./settings";
import { recordRoutes as feeStructureRecordRoutes, routes as feeStructureRoutes } from "./fee-structures";
import { routes as invoiceRoutes } from "./invoices";
import { routes as paymentRoutes } from "./payments";
import { routes as creditRoutes } from "./credits";
import { routes as ledgerRoutes } from "./ledger";
import { routes as activityRoutes } from "./activity";

/* Finance › Setup (FI-01 to FI-06): the setup pages share one side list */
const setupRoutes: RouteObject[] = [...feeHeadRoutes, ...feeStructureRoutes, ...installmentPlanRoutes, ...lateFeeRuleRoutes, ...concessionRoutes, ...financeSettingsRoutes];

/* Finance operations (FI-07 to FI-14): collect, invoices, payments area, ledger area, student accounts, activity */
const operationsRoutes: RouteObject[] = [...invoiceRoutes, ...paymentRoutes, ...creditRoutes, ...ledgerRoutes, ...activityRoutes];

/* Routes of the finance module (its submodules add theirs here) */
export const routes: RouteObject[] = [{ element: createElement(SetupLayout), children: setupRoutes }, ...feeStructureRecordRoutes, ...operationsRoutes];

/* For other modules: a button from the student profile to the student's fee account (FI-11) */
export { StudentAccountLink } from "./credits";
