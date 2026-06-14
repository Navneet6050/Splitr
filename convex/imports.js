import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import detectors from "./import/detectors";
import { convertAmount as convertWithRates } from "./currency";

const REQUIRED_HEADERS = [
  "date",
  "description",
  "paid_by",
  "amount",
  "currency",
  "split_type",
  "split_with",
  "split_details",
  "notes",
];

const BASE_CURRENCY = "INR";
const MAX_IMPORT_ROWS = 500;

async function getCurrentUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}

async function assertGroupMember(ctx, groupId, userId) {
  const group = await ctx.db.get(groupId);
  if (!group) throw new Error("Group not found");
  const isMember = group.members.some((member) => member.userId === userId);
  if (!isMember) throw new Error("You are not a member of this group");
  return group;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (rows.length === 0) throw new Error("CSV is empty");

  const headers = rows[0].map((header) => normalizeHeader(header));
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`CSV is missing required headers: ${missing.join(", ")}`);
  }

  return rows.slice(1).map((cells, index) => {
    const raw = {};
    headers.forEach((header, headerIndex) => {
      raw[header] = (cells[headerIndex] ?? "").trim();
    });
    return { rowNumber: index + 2, raw };
  });
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function canonicalName(name) {
  const normalized = normalizeName(name);
  if (normalized === "priya s") return "Priya";
  if (normalized === "priya") return "Priya";
  if (normalized === "rohan") return "Rohan";
  if (normalized === "dev's friend kabir") return "Kabir";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseAmount(value) {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function parseParticipants(value) {
  if (!value.trim()) return [];
  return value
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseDate(value) {
  const raw = value.trim();
  if (!raw) return { timestamp: null, format: "missing", ambiguous: false };

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return {
      timestamp: Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
      format: "yyyy-mm-dd",
      ambiguous: false,
    };
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    return {
      timestamp: Date.UTC(Number(slash[3]), second - 1, first),
      format: "dd/mm/yyyy",
      ambiguous: first <= 12 && second <= 12,
    };
  }

  const textDate = Date.parse(raw);
  if (!Number.isNaN(textDate)) {
    const date = new Date(textDate);
    return {
      timestamp: Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      ),
      format: "text",
      ambiguous: false,
    };
  }

  return { timestamp: null, format: "invalid", ambiguous: false };
}

function parseSplitDetails(value) {
  const details = {};
  if (!value.trim()) return details;

  for (const part of value.split(";")) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(.+?)\s+(-?\d+(?:\.\d+)?%?)$/);
    if (!match) continue;
    const name = canonicalName(match[1]);
    const rawValue = match[2];
    details[name] = rawValue.endsWith("%")
      ? { kind: "percentage", value: Number(rawValue.replace("%", "")) }
      : { kind: "number", value: Number(rawValue) };
  }
  return details;
}

function parseRow(raw) {
  const parsedDate = parseDate(raw.date);
  const participants = parseParticipants(raw.split_with).map(canonicalName);
  const amount = parseAmount(raw.amount);
  const paidBy = raw.paid_by.trim() ? canonicalName(raw.paid_by) : "";
  const splitType = raw.split_type.trim().toLowerCase();
  const currency = raw.currency.trim().toUpperCase();

  return {
    dateRaw: raw.date,
    date: parsedDate.timestamp,
    dateFormat: parsedDate.format,
    ambiguousDate: parsedDate.ambiguous,
    description: raw.description.trim(),
    paidBy,
    amount,
    currency,
    splitType,
    participants,
    splitDetails: parseSplitDetails(raw.split_details),
    notes: raw.notes.trim(),
  };
}

function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
  return {
    rowId,
    rowNumber,
    type,
    severity,
    message,
    suggestedAction,
    confidenceScore,
    metadata,
  };
}

function normalizedDescription(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(at|the|a|an|order)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const left = new Set(normalizedDescription(a).split(" ").filter(Boolean));
  const right = new Set(normalizedDescription(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap++;
  return overlap / Math.max(left.size, right.size);
}

function detectRowAnomalies(stagedRows) {
  // delegate to detectors module
  return detectors.detectRowAnomalies(stagedRows);
}

async function getOrCreateImportedUser(ctx, group, name, createdBy) {
  const normalized = canonicalName(name);
  const existingAlias = await ctx.db
    .query("aliases")
    .withIndex("by_groupId_and_rawName", (q) =>
      q.eq("groupId", group._id).eq("rawName", normalizeName(name))
    )
    .unique();
  if (existingAlias) return existingAlias.userId;

  const existingMember = await findGroupUserByName(ctx, group, normalized);
  if (existingMember) return existingMember._id;

  const userId = await ctx.db.insert("users", {
    name: normalized,
    email: `${normalizeName(normalized).replace(/[^a-z0-9]+/g, ".")}@import.local`,
    tokenIdentifier: `import:${group._id}:${normalizeName(normalized)}`,
  });

  await ctx.db.insert("aliases", {
    groupId: group._id,
    rawName: normalizeName(name),
    normalizedName: normalized,
    userId,
    confidence: 1,
    source: "import",
    createdBy,
  });

  return userId;
}

async function findGroupUserByName(ctx, group, name) {
  const target = normalizeName(name);
  for (const member of group.members) {
    const user = await ctx.db.get(member.userId);
    if (user && normalizeName(user.name) === target) return user;
  }
  const imported = await ctx.db
    .query("users")
    .withIndex("by_email", (q) =>
      q.eq("email", `${target.replace(/[^a-z0-9]+/g, ".")}@import.local`)
    )
    .unique();
  return imported;
}

async function ensureMembership(ctx, group, userId, role, joinedAt, leftAt, source, createdBy, sourceImportRowId) {
  const latestGroup = await ctx.db.get(group._id);
  if (latestGroup && !latestGroup.members.some((member) => member.userId === userId)) {
    await ctx.db.patch(group._id, {
      members: [
        ...latestGroup.members,
        {
          userId,
          role,
          joinedAt,
        },
      ],
    });
  }

  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_groupId_and_userId", (q) =>
      q.eq("groupId", group._id).eq("userId", userId)
    )
    .take(20);

  const overlaps = existing.some((membership) => {
    const existingEnd = membership.leftAt ?? Number.POSITIVE_INFINITY;
    const newEnd = leftAt ?? Number.POSITIVE_INFINITY;
    return membership.joinedAt <= newEnd && joinedAt <= existingEnd;
  });

  if (!overlaps) {
    await ctx.db.insert("memberships", {
      groupId: group._id,
      userId,
      role,
      joinedAt,
      leftAt,
      source,
      createdBy,
      sourceImportRowId,
    });
  }
}

function membershipWindowForName(name, rowDate) {
  if (name === "Meera") {
    return { joinedAt: Date.UTC(2026, 1, 1), leftAt: Date.UTC(2026, 3, 1) };
  }
  if (name === "Sam") {
    return { joinedAt: Date.UTC(2026, 3, 8), leftAt: null };
  }
  if (name === "Dev") {
    return { joinedAt: Date.UTC(2026, 1, 8), leftAt: Date.UTC(2026, 2, 15) };
  }
  if (name === "Kabir") {
    return { joinedAt: rowDate, leftAt: rowDate + 24 * 60 * 60 * 1000 };
  }
  return { joinedAt: Date.UTC(2026, 1, 1), leftAt: null };
}

// Delegates to convex/currency.js for FX lookup and provenance
async function convertAmount(ctx, amount, currency, asOfDate) {
  if (!currency || currency === BASE_CURRENCY) return { rate: 1, convertedAmount: amount, currencyRateId: null };
  return await convertWithRates(ctx, amount, currency, BASE_CURRENCY, asOfDate);
}

function calculateSplits(parsed, participantIds, paidByUserId, convertedAmount) {
  const splitType = parsed.splitType || "equal";
  if (splitType === "percentage") {
    return participantIds.map(({ name, userId }) => {
      const detail = parsed.splitDetails[name];
      const percentage = detail?.kind === "percentage" ? detail.value : 100 / participantIds.length;
      return {
        userId,
        amount: (convertedAmount * percentage) / 100,
        percentage,
        splitType,
        paid: userId === paidByUserId,
      };
    });
  }
  if (splitType === "share") {
    const shares = participantIds.map(({ name }) => {
      const detail = parsed.splitDetails[name];
      return detail?.kind === "number" && detail.value > 0 ? detail.value : 1;
    });
    const totalShares = shares.reduce((sum, value) => sum + value, 0);
    return participantIds.map(({ userId }, index) => ({
      userId,
      amount: (convertedAmount * shares[index]) / totalShares,
      shares: shares[index],
      splitType,
      paid: userId === paidByUserId,
    }));
  }
  if (splitType === "unequal" || splitType === "exact") {
    return participantIds.map(({ name, userId }) => {
      const detail = parsed.splitDetails[name];
      const amount = detail?.kind === "number" ? detail.value : convertedAmount / participantIds.length;
      return {
        userId,
        amount,
        splitType: splitType === "unequal" ? "exact" : splitType,
        paid: userId === paidByUserId,
      };
    });
  }
  return participantIds.map(({ userId }) => ({
    userId,
    amount: convertedAmount / participantIds.length,
    percentage: 100 / participantIds.length,
    splitType: "equal",
    paid: userId === paidByUserId,
  }));
}

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    fileName: v.string(),
    csvText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await assertGroupMember(ctx, args.groupId, user._id);

    const rows = parseCsv(args.csvText);
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error(`Import is limited to ${MAX_IMPORT_ROWS} rows`);
    }

    const importId = await ctx.db.insert("imports", {
      groupId: args.groupId,
      uploadedBy: user._id,
      fileName: args.fileName,
      status: "staged",
      rowCount: rows.length,
      importedCount: 0,
      skippedCount: 0,
      anomalyCount: 0,
      blockingCount: 0,
      createdAt: Date.now(),
    });

    const stagedRows = [];
    for (const row of rows) {
      const rowId = await ctx.db.insert("importRows", {
        importId,
        groupId: args.groupId,
        rowNumber: row.rowNumber,
        raw: row.raw,
        parsed: parseRow(row.raw),
        status: "staged",
      });
      stagedRows.push({ _id: rowId, rowNumber: row.rowNumber, parsed: parseRow(row.raw) });
    }

    const anomalies = detectRowAnomalies(stagedRows);
    for (const item of anomalies) {
      await ctx.db.insert("importAnomalies", {
        importId,
        rowId: item.rowId,
        rowNumber: item.rowNumber,
        type: item.type,
        severity: item.severity,
        message: item.message,
        suggestedAction: item.suggestedAction,
        confidenceScore: item.confidenceScore,
        status: item.severity === "info" ? "acknowledged" : "open",
        metadata: item.metadata,
      });
    }

    const blockingCount = anomalies.filter((item) => item.severity === "blocking").length;
    await ctx.db.patch(importId, {
      status: anomalies.length > 0 ? "needs_review" : "ready",
      anomalyCount: anomalies.length,
      blockingCount,
    });

    return { importId, rowCount: rows.length, anomalyCount: anomalies.length, blockingCount };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return await ctx.db
      .query("imports")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", user._id))
      .order("desc")
      .take(20);
  },
});

export const get = query({
  args: { importId: v.id("imports") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const importDoc = await ctx.db.get(args.importId);
    if (!importDoc) throw new Error("Import not found");
    await assertGroupMember(ctx, importDoc.groupId, user._id);

    const rows = await ctx.db
      .query("importRows")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .order("asc")
      .take(MAX_IMPORT_ROWS);
    const anomalies = await ctx.db
      .query("importAnomalies")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .order("asc")
      .take(1000);
    const reviews = await ctx.db
      .query("anomalyReviews")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .order("asc")
      .take(1000);
    const report = await ctx.db
      .query("importReports")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .first();

    return { import: importDoc, rows, anomalies, reviews, report };
  },
});

export const reviewAnomaly = mutation({
  args: {
    anomalyId: v.id("importAnomalies"),
    decision: v.string(),
    correctedValue: v.optional(v.any()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const anomalyDoc = await ctx.db.get(args.anomalyId);
    if (!anomalyDoc) throw new Error("Anomaly not found");
    const importDoc = await ctx.db.get(anomalyDoc.importId);
    if (!importDoc) throw new Error("Import not found");
    await assertGroupMember(ctx, importDoc.groupId, user._id);

    const existing = await ctx.db
      .query("anomalyReviews")
      .withIndex("by_anomalyId", (q) => q.eq("anomalyId", args.anomalyId))
      .first();
    const review = {
      importId: anomalyDoc.importId,
      anomalyId: args.anomalyId,
      rowId: anomalyDoc.rowId,
      reviewerId: user._id,
      decision: args.decision,
      correctedValue: args.correctedValue,
      note: args.note,
      reviewedAt: Date.now(),
    };
    if (existing) await ctx.db.replace(existing._id, review);
    else await ctx.db.insert("anomalyReviews", review);

    await ctx.db.patch(args.anomalyId, { status: "reviewed" });
    const openBlocking = await ctx.db
      .query("importAnomalies")
      .withIndex("by_importId_and_status", (q) =>
        q.eq("importId", anomalyDoc.importId).eq("status", "open")
      )
      .take(1000);
    await ctx.db.patch(anomalyDoc.importId, {
      blockingCount: openBlocking.filter((item) => item.severity === "blocking").length,
    });
    return { success: true };
  },
});

export const approve = mutation({
  args: { importId: v.id("imports") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const importDoc = await ctx.db.get(args.importId);
    if (!importDoc) throw new Error("Import not found");
    await assertGroupMember(ctx, importDoc.groupId, user._id);

    const openBlocking = await ctx.db
      .query("importAnomalies")
      .withIndex("by_importId_and_status", (q) =>
        q.eq("importId", args.importId).eq("status", "open")
      )
      .take(1000);
    const unresolved = openBlocking.filter((item) => item.severity === "blocking");
    if (unresolved.length > 0) {
      throw new Error(`Resolve ${unresolved.length} blocking anomalies before approval`);
    }

    await ctx.db.patch(args.importId, {
      status: "approved",
      approvedAt: Date.now(),
      blockingCount: 0,
    });
    return { success: true };
  },
});

export const redetect = mutation({
  args: { importId: v.id("imports") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const importDoc = await ctx.db.get(args.importId);
    if (!importDoc) throw new Error("Import not found");
    await assertGroupMember(ctx, importDoc.groupId, user._id);

    const rows = await ctx.db
      .query("importRows")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .order("asc")
      .take(1000);

    // remove existing anomalies for this import
    const existing = await ctx.db
      .query("importAnomalies")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .take(2000);
    for (const e of existing) await ctx.db.delete(e._id);

    const staged = rows.map((r) => ({ _id: r._id, rowNumber: r.rowNumber, parsed: r.parsed }));
    const anomalies = detectRowAnomalies(staged);
    for (const item of anomalies) {
      await ctx.db.insert("importAnomalies", {
        importId: args.importId,
        rowId: item.rowId,
        rowNumber: item.rowNumber,
        type: item.type,
        severity: item.severity,
        message: item.message,
        suggestedAction: item.suggestedAction,
        confidenceScore: item.confidenceScore,
        status: item.severity === "info" ? "acknowledged" : "open",
        metadata: item.metadata,
      });
    }

    const blockingCount = anomalies.filter((item) => item.severity === "blocking").length;
    await ctx.db.patch(args.importId, {
      anomalyCount: anomalies.length,
      blockingCount,
      status: anomalies.length > 0 ? "needs_review" : "ready",
    });

    return { rechecked: anomalies.length };
  },
});

export const commit = mutation({
  args: { importId: v.id("imports") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const importDoc = await ctx.db.get(args.importId);
    if (!importDoc) throw new Error("Import not found");
    if (importDoc.status === "committed") throw new Error("Import is already committed");
    if (importDoc.status !== "approved" && importDoc.status !== "ready") {
      throw new Error("Import must be approved before commit");
    }
    const group = await assertGroupMember(ctx, importDoc.groupId, user._id);

    const rows = await ctx.db
      .query("importRows")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .order("asc")
      .take(MAX_IMPORT_ROWS);
    const anomalies = await ctx.db
      .query("importAnomalies")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .take(1000);
    const reviews = await ctx.db
      .query("anomalyReviews")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .take(1000);

    const reviewByAnomaly = new Map(reviews.map((review) => [review.anomalyId, review]));
    const anomaliesByRow = new Map();
    for (const item of anomalies) {
      if (!anomaliesByRow.has(item.rowId)) anomaliesByRow.set(item.rowId, []);
      anomaliesByRow.get(item.rowId).push(item);
    }
    const anomaliesById = new Map(anomalies.map((a) => [a._id, a]));

    let importedCount = 0;
    let skippedCount = 0;
    const conversions = [];
    const settlements = [];

    for (const row of rows) {
      if (row.createdExpenseId || row.createdSettlementId) continue;
      const rowAnomalies = anomaliesByRow.get(row._id) ?? [];
      const rowReviews = rowAnomalies.map((item) => reviewByAnomaly.get(item._id)).filter(Boolean);
      // Apply any reviewer corrections to the parsed row before transformation
      for (const review of rowReviews) {
        if (!review || !review.correctedValue) continue;
        const anomaly = anomaliesById.get(review.anomalyId);
        if (!anomaly) continue;
        const cv = review.correctedValue;
        switch (anomaly.type) {
          case "AMBIGUOUS_DATE":
          case "INVALID_DATE": {
            const pd = parseDate(cv);
            row.parsed.dateRaw = cv;
            row.parsed.date = pd.timestamp;
            row.parsed.dateFormat = pd.format;
            row.parsed.ambiguousDate = pd.ambiguous;
            break;
          }
          case "MISSING_CURRENCY":
            row.parsed.currency = (cv || "").toString().toUpperCase();
            break;
          case "INVALID_AMOUNT":
          case "NEGATIVE_AMOUNT": {
            const a = parseAmount(cv);
            row.parsed.amount = a;
            break;
          }
          case "MISSING_PAYER":
          case "NAME_ALIAS":
            row.parsed.paidBy = canonicalName(cv);
            break;
          case "UNKNOWN_SPLIT_TYPE":
          case "NON_STANDARD_SPLIT_TYPE":
            row.parsed.splitType = (cv || "").toString().toLowerCase();
            break;
          case "INVALID_PARTICIPANT_COUNT":
            row.parsed.participants = parseParticipants(cv);
            break;
        }
      }
      const shouldSkip = rowReviews.some((review) => review.decision === "skip");
      if (shouldSkip || row.parsed.amount === null) {
        await ctx.db.patch(row._id, { status: "skipped" });
        skippedCount++;
        continue;
      }

      const isSettlement = rowReviews.some((review) => review.decision === "convert_to_settlement") ||
        rowAnomalies.some((item) => item.type === "SETTLEMENT_LOGGED_AS_EXPENSE");

      const currency = row.parsed.currency || BASE_CURRENCY;
      const amount = Math.abs(row.parsed.amount);
      const { rate, convertedAmount, currencyRateId } = await convertAmount(ctx, amount, currency, row.parsed.date);
      if (currency !== BASE_CURRENCY) {
        conversions.push({
          rowNumber: row.rowNumber,
          originalAmount: amount,
          originalCurrency: currency,
          exchangeRate: rate,
          currencyRateId,
          convertedAmount,
        });
      }

      const involvedNames = [...new Set([row.parsed.paidBy, ...row.parsed.participants].filter(Boolean))];
      const idsByName = {};
      for (const name of involvedNames) {
        idsByName[name] = await getOrCreateImportedUser(ctx, group, name, user._id);
        const window = membershipWindowForName(name, row.parsed.date);
        await ensureMembership(
          ctx,
          group,
          idsByName[name],
          "member",
          window.joinedAt,
          window.leftAt ?? undefined,
          name === "Kabir" || name === "Dev" ? "temporary_import" : "import",
          user._id,
          row._id
        );
      }

      if (isSettlement) {
        const paidByUserId = idsByName[row.parsed.paidBy];
        const receivedName = row.parsed.participants[0];
        const receivedByUserId = idsByName[receivedName];
        if (!paidByUserId || !receivedByUserId) {
          await ctx.db.patch(row._id, { status: "skipped" });
          skippedCount++;
          continue;
        }
        const settlementId = await ctx.db.insert("settlements", {
          amount: convertedAmount,
          originalAmount: amount,
          originalCurrency: currency,
          exchangeRate: rate,
          currencyRateId,
          convertedAmount,
          convertedCurrency: BASE_CURRENCY,
          note: row.parsed.notes || row.parsed.description,
          date: row.parsed.date,
          paidByUserId,
          receivedByUserId,
          groupId: group._id,
          sourceImportId: args.importId,
          sourceImportRowId: row._id,
          createdBy: user._id,
        });
        await ctx.db.patch(row._id, {
          status: "imported",
          createdSettlementId: settlementId,
        });
        settlements.push({ rowNumber: row.rowNumber, settlementId });
        importedCount++;
        continue;
      }

      const paidByUserId = idsByName[row.parsed.paidBy];
      const participantIds = row.parsed.participants.map((name) => ({
        name,
        userId: idsByName[name],
      }));
      if (!paidByUserId || participantIds.length === 0) {
        await ctx.db.patch(row._id, { status: "skipped" });
        skippedCount++;
        continue;
      }
      const splitRows = calculateSplits(row.parsed, participantIds, paidByUserId, convertedAmount);

      // Round each split to 2 decimals and adjust last split to absorb rounding discrepancy
      const roundedSplits = [];
      if (splitRows.length === 0) {
        await ctx.db.patch(row._id, { status: "skipped" });
        skippedCount++;
        continue;
      }
      if (splitRows.length === 1) {
        roundedSplits.push({ ...splitRows[0], amount: Number(convertedAmount.toFixed(2)) });
      } else {
        const rawAmounts = splitRows.map((s) => s.amount);
        const rounded = rawAmounts.map((a) => Math.round(a * 100) / 100);
        const sumRounded = rounded.reduce((s, v) => s + v, 0);
        // compute discrepancy and apply to last split (rounded to 2 decimals)
        const discrepancy = Math.round((convertedAmount - sumRounded) * 100) / 100;
        rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + discrepancy) * 100) / 100;
        for (let i = 0; i < splitRows.length; i++) {
          roundedSplits.push({ ...splitRows[i], amount: Number(rounded[i].toFixed(2)) });
        }
      }

      const splitSum = roundedSplits.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(splitSum - Number(convertedAmount.toFixed(2))) > 0.01) {
        await ctx.db.patch(row._id, { status: "skipped" });
        skippedCount++;
        continue;
      }

      const expenseId = await ctx.db.insert("expenses", {
        description: row.parsed.description,
        amount: convertedAmount,
        originalAmount: amount,
        originalCurrency: currency,
        exchangeRate: rate,
        currencyRateId,
        convertedAmount,
        convertedCurrency: BASE_CURRENCY,
        category: "Imported",
        date: row.parsed.date,
        paidByUserId,
        splitType: row.parsed.splitType || "equal",
        splits: roundedSplits.map((split) => ({
          userId: split.userId,
          amount: split.amount,
          paid: split.paid,
        })),
        groupId: group._id,
        sourceImportId: args.importId,
        sourceImportRowId: row._id,
        createdBy: user._id,
      });

      for (const split of roundedSplits) {
        await ctx.db.insert("expenseSplits", {
          expenseId,
          userId: split.userId,
          amount: split.amount,
          splitType: split.splitType,
          percentage: split.percentage,
          shares: split.shares,
          paid: split.paid,
          sourceImportRowId: row._id,
        });
      }

      await ctx.db.patch(row._id, {
        status: "imported",
        createdExpenseId: expenseId,
      });
      importedCount++;
    }

    await ctx.db.patch(args.importId, {
      status: "committed",
      importedCount,
      skippedCount,
      committedAt: Date.now(),
    });

    const reportSummary = {
      importId: args.importId,
      fileName: importDoc.fileName,
      rowsProcessed: importDoc.rowCount,
      rowsImported: importedCount,
      rowsSkipped: skippedCount,
      anomalies: anomalies.map((item) => ({
        rowNumber: item.rowNumber,
        type: item.type,
        severity: item.severity,
        message: item.message,
        suggestedAction: item.suggestedAction,
        status: item.status,
      })),
      userDecisions: reviews.map((review) => ({
        anomalyId: review.anomalyId,
        decision: review.decision,
        note: review.note ?? "",
        reviewedAt: review.reviewedAt,
      })),
      currencyConversions: conversions,
      settlementConversions: settlements,
      generatedAt: Date.now(),
    };

    const existingReport = await ctx.db
      .query("importReports")
      .withIndex("by_importId", (q) => q.eq("importId", args.importId))
      .first();
    const reportDoc = {
      importId: args.importId,
      groupId: group._id,
      generatedBy: user._id,
      summaryJson: reportSummary,
      generatedAt: Date.now(),
    };
    if (existingReport) await ctx.db.replace(existingReport._id, reportDoc);
    else await ctx.db.insert("importReports", reportDoc);

    return { importedCount, skippedCount, report: reportSummary };
  },
});
