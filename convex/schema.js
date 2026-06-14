import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    tokenIdentifier: v.string(),
    imageUrl: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .searchIndex("search_name", { searchField: "name" })
    .searchIndex("search_email", { searchField: "email" }),

  // Expenses
  expenses: defineTable({
    description: v.string(),
    amount: v.number(),
    originalAmount: v.optional(v.number()),
    originalCurrency: v.optional(v.string()),
    exchangeRate: v.optional(v.number()),
    convertedAmount: v.optional(v.number()),
    convertedCurrency: v.optional(v.string()),
    currencyRateId: v.optional(v.id("currencyRates")),
    sourceImportId: v.optional(v.id("imports")),
    sourceImportRowId: v.optional(v.id("importRows")),
    category: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"), // Reference to users table
    splitType: v.string(), // "equal", "percentage", "exact", "unequal", "share"
    splits: v.array(
      v.object({
        userId: v.id("users"), // Reference to users table
        amount: v.number(), // amount owed by this user
        paid: v.boolean(),
      })
    ),
    groupId: v.optional(v.id("groups")), // null for one-on-one expenses
    createdBy: v.id("users"), // Reference to users table
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_date", ["date"])
    .index("by_group_and_date", ["groupId", "date"])
    .index("by_sourceImportRowId", ["sourceImportRowId"]),

  expenseSplits: defineTable({
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    amount: v.number(),
    splitType: v.string(),
    percentage: v.optional(v.number()),
    shares: v.optional(v.number()),
    paid: v.boolean(),
    sourceImportRowId: v.optional(v.id("importRows")),
  })
    .index("by_expenseId", ["expenseId"])
    .index("by_userId", ["userId"])
    .index("by_userId_and_expenseId", ["userId", "expenseId"]),

  // Settlements
  settlements: defineTable({
    amount: v.number(),
    originalAmount: v.optional(v.number()),
    originalCurrency: v.optional(v.string()),
    exchangeRate: v.optional(v.number()),
    convertedAmount: v.optional(v.number()),
    convertedCurrency: v.optional(v.string()),
    sourceImportId: v.optional(v.id("imports")),
    sourceImportRowId: v.optional(v.id("importRows")),
    note: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"), // Reference to users table
    receivedByUserId: v.id("users"), // Reference to users table
    groupId: v.optional(v.id("groups")), // null for one-on-one settlements
    relatedExpenseIds: v.optional(v.array(v.id("expenses"))), // Which expenses this settlement covers
    createdBy: v.id("users"), // Reference to users table
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_receiver_and_group", ["receivedByUserId", "groupId"])
    .index("by_date", ["date"])
    .index("by_group_and_date", ["groupId", "date"])
    .index("by_sourceImportRowId", ["sourceImportRowId"]),

  // Groups
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"), // Reference to users table
    members: v.array(
      v.object({
        userId: v.id("users"), // Reference to users table
        role: v.string(), // "admin" or "member"
        joinedAt: v.number(),
      })
    ),
  }),

  memberships: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.string(),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
    source: v.string(),
    sourceImportRowId: v.optional(v.id("importRows")),
    createdBy: v.id("users"),
  })
    .index("by_groupId", ["groupId"])
    .index("by_userId", ["userId"])
    .index("by_groupId_and_userId", ["groupId", "userId"])
    .index("by_groupId_and_joinedAt", ["groupId", "joinedAt"]),

  imports: defineTable({
    groupId: v.id("groups"),
    uploadedBy: v.id("users"),
    fileName: v.string(),
    status: v.string(),
    rowCount: v.number(),
    importedCount: v.number(),
    skippedCount: v.number(),
    anomalyCount: v.number(),
    blockingCount: v.number(),
    createdAt: v.number(),
    approvedAt: v.optional(v.number()),
    committedAt: v.optional(v.number()),
  })
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_groupId", ["groupId"])
    .index("by_status", ["status"]),

  importRows: defineTable({
    importId: v.id("imports"),
    groupId: v.id("groups"),
    rowNumber: v.number(),
    raw: v.record(v.string(), v.string()),
    parsed: v.any(),
    normalized: v.optional(v.any()),
    status: v.string(),
    createdExpenseId: v.optional(v.id("expenses")),
    createdSettlementId: v.optional(v.id("settlements")),
  })
    .index("by_importId", ["importId"])
    .index("by_importId_and_rowNumber", ["importId", "rowNumber"])
    .index("by_importId_and_status", ["importId", "status"]),

  importAnomalies: defineTable({
    importId: v.id("imports"),
    rowId: v.id("importRows"),
    rowNumber: v.number(),
    type: v.string(),
    severity: v.string(),
    message: v.string(),
    suggestedAction: v.string(),
    confidenceScore: v.number(),
    status: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_importId", ["importId"])
    .index("by_rowId", ["rowId"])
    .index("by_importId_and_status", ["importId", "status"])
    .index("by_importId_and_type", ["importId", "type"]),

  anomalyReviews: defineTable({
    importId: v.id("imports"),
    anomalyId: v.id("importAnomalies"),
    rowId: v.id("importRows"),
    reviewerId: v.id("users"),
    decision: v.string(),
    correctedValue: v.optional(v.any()),
    note: v.optional(v.string()),
    reviewedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_anomalyId", ["anomalyId"])
    .index("by_reviewerId", ["reviewerId"]),

  aliases: defineTable({
    groupId: v.id("groups"),
    rawName: v.string(),
    normalizedName: v.string(),
    userId: v.id("users"),
    confidence: v.number(),
    source: v.string(),
    sourceImportId: v.optional(v.id("imports")),
    createdBy: v.id("users"),
  })
    .index("by_groupId_and_rawName", ["groupId", "rawName"])
    .index("by_userId", ["userId"]),

  currencyRates: defineTable({
    fromCurrency: v.string(),
    toCurrency: v.string(),
    rate: v.number(),
    effectiveDate: v.number(),
    source: v.string(),
    createdBy: v.id("users"),
  })
    .index("by_fromCurrency_and_toCurrency_and_effectiveDate", [
      "fromCurrency",
      "toCurrency",
      "effectiveDate",
    ])
    .index("by_effectiveDate", ["effectiveDate"]),

  importReports: defineTable({
    importId: v.id("imports"),
    groupId: v.id("groups"),
    generatedBy: v.id("users"),
    summaryJson: v.any(),
    generatedAt: v.number(),
  })
    .index("by_importId", ["importId"])
    .index("by_groupId", ["groupId"]),
});
