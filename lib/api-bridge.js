"use server";

import * as users from "./actions/users";
import * as groups from "./actions/groups";
import * as expenses from "./actions/expenses";
import * as settlements from "./actions/settlements";
import * as memberships from "./actions/memberships";
import * as dashboard from "./actions/dashboard";
import * as contacts from "./actions/contacts";
import * as balances from "./actions/balances";
import * as imports from "./actions/imports";

// Central dispatcher mapping query paths to execution functions
const queries = {
  "users:getCurrentUser": users.getCurrentUser,
  "users:searchUsers": users.searchUsers,
  "groups:getGroupExpenses": groups.getGroupExpenses,
  "groups:getGroupOrMembers": groups.getGroupOrMembers,
  "expenses:getExpensesBetweenUsers": expenses.getExpensesBetweenUsers,
  "settlements:getSettlementData": settlements.getSettlementData,
  "memberships:listForGroup": memberships.listForGroup,
  "imports:get": imports.get,
  "dashboard:getUserBalances": dashboard.getUserBalances,
  "dashboard:getUserGroups": dashboard.getUserGroups,
  "dashboard:getTotalSpent": dashboard.getTotalSpent,
  "dashboard:getMonthlySpending": dashboard.getMonthlySpending,
  "contacts:getAllContacts": contacts.getAllContacts,
  "balances:getDrilldown": balances.getDrilldown,
};

const mutations = {
  "users:store": users.storeUser,
  "groups:createGroup": contacts.createGroup,
  "contacts:createGroup": contacts.createGroup,
  "expenses:createExpense": expenses.createExpense,
  "expenses:deleteExpense": expenses.deleteExpense,
  "settlements:createSettlement": settlements.createSettlement,
  "memberships:upsert": memberships.upsert,
  "imports:redetect": imports.redetect,
  "imports:create": imports.create,
  "imports:reviewAnomaly": imports.reviewAnomaly,
  "imports:approve": imports.approve,
  "imports:commit": imports.commit,
};

export async function executeQuery(name, args) {
  const handler = queries[name];
  if (!handler) {
    throw new Error(`Query handler not found for: ${name}`);
  }
  try {
    return await handler(args);
  } catch (error) {
    console.error(`Error in query ${name}:`, error);
    throw new Error(error.message || "Query execution failed");
  }
}

export async function executeMutation(name, args) {
  const handler = mutations[name];
  if (!handler) {
    throw new Error(`Mutation handler not found for: ${name}`);
  }
  try {
    return await handler(args);
  } catch (error) {
    console.error(`Error in mutation ${name}:`, error);
    throw new Error(error.message || "Mutation execution failed");
  }
}
