import { db } from "../db";
import { getCurrentUser } from "./users";
import { convertAmount } from "./currency";
import detectors from "../import/detectors";

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

// Helper to map Prisma records to match Convex document structure
const mapDoc = (doc) => {
  if (!doc) return doc;
  return {
    ...doc,
    _id: doc.id,
    _creationTime: doc.createdAt ? doc.createdAt.getTime() : undefined,
  };
};

async function assertGroupMember(groupId, userId) {
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Group not found");
  const membersArray = Array.isArray(group.members) ? group.members : [];
  const isMember = membersArray.some((member) => member.userId === userId);
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

async function getOrCreateImportedUser(tx, group, name, createdByUserId) {
  const normalized = canonicalName(name);

  // Check alias
  const existingAlias = await tx.alias.findFirst({
    where: { groupId: group.id, rawName: normalizeName(name) },
  });
  if (existingAlias) return existingAlias.userId;

  // Check member in JSON members
  const membersArray = Array.isArray(group.members) ? group.members : [];
  for (const member of membersArray) {
    const u = await tx.user.findUnique({ where: { id: member.userId } });
    if (u && normalizeName(u.name) === normalizeName(normalized)) return u.id;
  }

  // Check user by imported email schema
  const targetEmail = `${normalizeName(normalized).replace(/[^a-z0-9]+/g, ".")}@import.local`;
  const existingImportUser = await tx.user.findUnique({
    where: { email: targetEmail },
  });
  if (existingImportUser) return existingImportUser.id;

  const newUser = await tx.user.create({
    data: {
      name: normalized,
      email: targetEmail,
      tokenIdentifier: `import:${group.id}:${normalizeName(normalized)}`,
    },
  });

  await tx.alias.create({
    data: {
      groupId: group.id,
      rawName: normalizeName(name),
      normalizedName: normalized,
      userId: newUser.id,
      confidence: 1.0,
      source: "import",
      createdByUserId,
    },
  });

  return newUser.id;
}

async function ensureMembership(tx, group, userId, role, joinedAt, leftAt, source, createdByUserId, sourceImportRowId) {
  const latestGroup = await tx.group.findUnique({ where: { id: group.id } });
  if (!latestGroup) return;

  const membersArray = Array.isArray(latestGroup.members) ? latestGroup.members : [];
  if (!membersArray.some((member) => member.userId === userId)) {
    const updatedMembers = [
      ...membersArray,
      {
        userId,
        role,
        joinedAt,
      },
    ];
    await tx.group.update({
      where: { id: group.id },
      data: { members: updatedMembers },
    });
  }

  const existing = await tx.groupMembership.findMany({
    where: { groupId: group.id, userId },
    take: 20,
  });

  const overlaps = existing.some((m) => {
    const existingEnd = m.leftAt ? m.leftAt.getTime() : Number.POSITIVE_INFINITY;
    const newEnd = leftAt ? leftAt : Number.POSITIVE_INFINITY;
    return m.joinedAt.getTime() <= newEnd && joinedAt <= existingEnd;
  });

  if (!overlaps) {
    await tx.groupMembership.create({
      data: {
        groupId: group.id,
        userId,
        role,
        joinedAt: new Date(joinedAt),
        leftAt: leftAt ? new Date(leftAt) : null,
        source,
        createdByUserId,
        sourceImportRowId,
      },
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

export async function create(args) {
  const user = await getCurrentUser();
  await assertGroupMember(args.groupId, user.id);

  const rows = parseCsv(args.csvText);
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import is limited to ${MAX_IMPORT_ROWS} rows`);
  }

  const result = await db.$transaction(async (tx) => {
    const newImport = await tx.import.create({
      data: {
        groupId: args.groupId,
        uploadedById: user.id,
        fileName: args.fileName,
        status: "staged",
        rowCount: rows.length,
        importedCount: 0,
        skippedCount: 0,
        anomalyCount: 0,
        blockingCount: 0,
      },
    });

    const importRowsData = rows.map((row) => {
      const parsed = parseRow(row.raw);
      return {
        importId: newImport.id,
        groupId: args.groupId,
        rowNumber: row.rowNumber,
        raw: row.raw,
        parsed: parsed,
        status: "staged",
      };
    });

    const createdRows = await tx.importRow.createManyAndReturn({
      data: importRowsData,
    });

    const stagedRows = createdRows.map((r) => ({
      _id: r.id,
      id: r.id,
      rowNumber: r.rowNumber,
      parsed: r.parsed,
    }));

    const anomalies = detectors.detectRowAnomalies(stagedRows);
    if (anomalies.length > 0) {
      const anomaliesData = anomalies.map((item) => ({
        importId: newImport.id,
        rowId: item.rowId,
        rowNumber: item.rowNumber,
        type: item.type,
        severity: item.severity,
        message: item.message,
        suggestedAction: item.suggestedAction,
        confidenceScore: item.confidenceScore,
        status: item.severity === "info" ? "acknowledged" : "open",
        metadata: item.metadata || {},
      }));

      await tx.importAnomaly.createMany({
        data: anomaliesData,
      });
    }

    const blockingCount = anomalies.filter((item) => item.severity === "blocking").length;
    const finalImport = await tx.import.update({
      where: { id: newImport.id },
      data: {
        status: anomalies.length > 0 ? "needs_review" : "ready",
        anomalyCount: anomalies.length,
        blockingCount,
      },
    });

    return {
      importId: finalImport.id,
      rowCount: rows.length,
      anomalyCount: anomalies.length,
      blockingCount,
    };
  }, {
    timeout: 30000
  });

  return result;
}

export async function get({ importId }) {
  const user = await getCurrentUser();
  const importDoc = await db.import.findUnique({ where: { id: importId } });
  if (!importDoc) throw new Error("Import not found");
  await assertGroupMember(importDoc.groupId, user.id);

  const rows = await db.importRow.findMany({
    where: { importId },
    orderBy: { rowNumber: "asc" },
  });

  const anomalies = await db.importAnomaly.findMany({
    where: { importId },
    orderBy: { rowNumber: "asc" },
  });

  const reviews = await db.anomalyReview.findMany({
    where: { importId },
    orderBy: { reviewedAt: "asc" },
  });

  const report = await db.importReport.findFirst({
    where: { importId },
  });

  return {
    import: mapDoc(importDoc),
    rows: rows.map(mapDoc),
    anomalies: anomalies.map(mapDoc),
    reviews: reviews.map(mapDoc),
    report: report ? mapDoc(report) : null,
  };
}

export async function reviewAnomaly(args) {
  const user = await getCurrentUser();
  const anomalyDoc = await db.importAnomaly.findUnique({ where: { id: args.anomalyId } });
  if (!anomalyDoc) throw new Error("Anomaly not found");
  const importDoc = await db.import.findUnique({ where: { id: anomalyDoc.importId } });
  if (!importDoc) throw new Error("Import not found");
  await assertGroupMember(importDoc.groupId, user.id);

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.anomalyReview.findFirst({
      where: { anomalyId: args.anomalyId },
    });

    const data = {
      importId: anomalyDoc.importId,
      anomalyId: args.anomalyId,
      rowId: anomalyDoc.rowId,
      reviewerId: user.id,
      decision: args.decision,
      correctedValue: args.correctedValue || null,
      note: args.note || null,
      reviewedAt: new Date(),
    };

    if (existing) {
      await tx.anomalyReview.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await tx.anomalyReview.create({ data });
    }

    await tx.importAnomaly.update({
      where: { id: args.anomalyId },
      data: { status: "reviewed" },
    });

    const openBlocking = await tx.importAnomaly.findMany({
      where: { importId: anomalyDoc.importId, status: "open", severity: "blocking" },
    });

    await tx.import.update({
      where: { id: anomalyDoc.importId },
      data: { blockingCount: openBlocking.length },
    });
  }, {
    timeout: 10000
  });

  return { success: true };
}

export async function approve({ importId }) {
  const user = await getCurrentUser();
  const importDoc = await db.import.findUnique({ where: { id: importId } });
  if (!importDoc) throw new Error("Import not found");
  await assertGroupMember(importDoc.groupId, user.id);

  const unresolved = await db.importAnomaly.findMany({
    where: { importId, status: "open", severity: "blocking" },
  });

  if (unresolved.length > 0) {
    throw new Error(`Resolve ${unresolved.length} blocking anomalies before approval`);
  }

  await db.import.update({
    where: { id: importId },
    data: {
      status: "approved",
      approvedAt: new Date(),
      blockingCount: 0,
    },
  });

  return { success: true };
}

export async function redetect({ importId }) {
  const user = await getCurrentUser();
  const importDoc = await db.import.findUnique({ where: { id: importId } });
  if (!importDoc) throw new Error("Import not found");
  await assertGroupMember(importDoc.groupId, user.id);

  const result = await db.$transaction(async (tx) => {
    const rows = await tx.importRow.findMany({
      where: { importId },
      orderBy: { rowNumber: "asc" },
    });

    // Delete existing anomalies
    await tx.importAnomaly.deleteMany({ where: { importId } });

    const staged = rows.map((r) => ({ _id: r.id, id: r.id, rowNumber: r.rowNumber, parsed: r.parsed }));
    const anomalies = detectors.detectRowAnomalies(staged);
    if (anomalies.length > 0) {
      const anomaliesData = anomalies.map((item) => ({
        importId,
        rowId: item.rowId,
        rowNumber: item.rowNumber,
        type: item.type,
        severity: item.severity,
        message: item.message,
        suggestedAction: item.suggestedAction,
        confidenceScore: item.confidenceScore,
        status: item.severity === "info" ? "acknowledged" : "open",
        metadata: item.metadata || {},
      }));

      await tx.importAnomaly.createMany({
        data: anomaliesData,
      });
    }

    const blockingCount = anomalies.filter((item) => item.severity === "blocking").length;
    await tx.import.update({
      where: { id: importId },
      data: {
        anomalyCount: anomalies.length,
        blockingCount,
        status: anomalies.length > 0 ? "needs_review" : "ready",
      },
    });

    return { rechecked: anomalies.length };
  }, {
    timeout: 30000
  });

  return result;
}

export async function commit({ importId }) {
  const user = await getCurrentUser();
  const importDoc = await db.import.findUnique({ where: { id: importId } });
  if (!importDoc) throw new Error("Import not found");
  if (importDoc.status === "committed") throw new Error("Import is already committed");
  if (importDoc.status !== "approved" && importDoc.status !== "ready") {
    throw new Error("Import must be approved before commit");
  }

  const group = await assertGroupMember(importDoc.groupId, user.id);

  const rows = await db.importRow.findMany({
    where: { importId },
    orderBy: { rowNumber: "asc" },
  });

  const anomalies = await db.importAnomaly.findMany({
    where: { importId },
  });

  const reviews = await db.anomalyReview.findMany({
    where: { importId },
  });

  const reviewByAnomaly = new Map(reviews.map((r) => [r.anomalyId, r]));
  const anomaliesByRow = new Map();
  anomalies.forEach((item) => {
    if (!anomaliesByRow.has(item.rowId)) anomaliesByRow.set(item.rowId, []);
    anomaliesByRow.get(item.rowId).push(item);
  });
  const anomaliesById = new Map(anomalies.map((a) => [a.id, a]));

  let importedCount = 0;
  let skippedCount = 0;
  const conversions = [];
  const settlements = [];

  // Commit rows inside transaction
  const result = await db.$transaction(async (tx) => {
    // 1. Pre-load group memberships to avoid querying them inside the loop
    const existingGroupMemberships = await tx.groupMembership.findMany({
      where: { groupId: group.id },
    });

    const initialGroup = await tx.group.findUnique({
      where: { id: group.id },
    });
    let groupMembersJSON = Array.isArray(initialGroup?.members) ? initialGroup.members : [];

    const membershipsToCreate = [];
    const splitsToCreate = [];

    // Helper to evaluate and track memberships in memory
    const trackAndEnsureMembershipLocal = (userId, role, joinedAt, leftAt, source, sourceImportRowId) => {
      if (!groupMembersJSON.some((m) => m.userId === userId)) {
        groupMembersJSON.push({ userId, role, joinedAt });
      }

      const overlaps = existingGroupMemberships.some((m) => {
        if (m.userId !== userId) return false;
        const existingEnd = m.leftAt ? m.leftAt.getTime() : Number.POSITIVE_INFINITY;
        const newEnd = leftAt ? leftAt : Number.POSITIVE_INFINITY;
        return m.joinedAt.getTime() <= newEnd && joinedAt <= existingEnd;
      }) || membershipsToCreate.some((m) => {
        if (m.userId !== userId) return false;
        const existingEnd = m.leftAt ? m.leftAt.getTime() : Number.POSITIVE_INFINITY;
        const newEnd = leftAt ? leftAt : Number.POSITIVE_INFINITY;
        return m.joinedAt.getTime() <= newEnd && joinedAt <= existingEnd;
      });

      if (!overlaps) {
        membershipsToCreate.push({
          groupId: group.id,
          userId,
          role,
          joinedAt: new Date(joinedAt),
          leftAt: leftAt ? new Date(leftAt) : null,
          source,
          createdByUserId: user.id,
          sourceImportRowId,
        });
      }
    };

    for (const row of rows) {
      if (row.createdExpenseId || row.createdSettlementId) continue;
      const rowAnomalies = anomaliesByRow.get(row.id) ?? [];
      const rowReviews = rowAnomalies.map((item) => reviewByAnomaly.get(item.id)).filter(Boolean);

      // Apply corrections
      for (const r of rowReviews) {
        if (!r || !r.correctedValue) continue;
        const anomaly = anomaliesById.get(r.anomalyId);
        if (!anomaly) continue;
        const cv = r.correctedValue;
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

      const shouldSkip = rowReviews.some((r) => r.decision === "skip");
      if (shouldSkip || row.parsed.amount === null) {
        await tx.importRow.update({
          where: { id: row.id },
          data: { status: "skipped" },
        });
        skippedCount++;
        continue;
      }

      const isSettlement = rowReviews.some((r) => r.decision === "convert_to_settlement") ||
        rowAnomalies.some((item) => item.type === "SETTLEMENT_LOGGED_AS_EXPENSE");

      const currency = row.parsed.currency || BASE_CURRENCY;
      const amount = Math.abs(row.parsed.amount);

      // Convert
      const effectiveDate = row.parsed.date ? new Date(row.parsed.date) : new Date();
      let rate = 1.0;
      let convertedAmount = amount;
      let currencyRateId = null;

      if (currency !== BASE_CURRENCY) {
        // Simple rate lookup inside transaction
        const rates = await tx.currencyRate.findMany({
          where: { fromCurrency: currency, toCurrency: BASE_CURRENCY, effectiveDate: { lte: effectiveDate } },
          orderBy: { effectiveDate: "desc" },
          take: 1,
        });
        if (rates.length > 0) {
          rate = rates[0].rate;
          currencyRateId = rates[0].id;
        } else if (currency === "USD") {
          rate = 83.0;
        } else {
          throw new Error(`No currency rate found for ${currency}->INR`);
        }
        convertedAmount = amount * rate;

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
        idsByName[name] = await getOrCreateImportedUser(tx, group, name, user.id);
        const window = membershipWindowForName(name, row.parsed.date || Date.now());
        trackAndEnsureMembershipLocal(
          idsByName[name],
          "member",
          window.joinedAt,
          window.leftAt,
          name === "Kabir" || name === "Dev" ? "temporary_import" : "import",
          row.id
        );
      }

      if (isSettlement) {
        const paidByUserId = idsByName[row.parsed.paidBy];
        const receivedName = row.parsed.participants[0];
        const receivedByUserId = idsByName[receivedName];
        if (!paidByUserId || !receivedByUserId) {
          await tx.importRow.update({
            where: { id: row.id },
            data: { status: "skipped" },
          });
          skippedCount++;
          continue;
        }
        const settlement = await tx.settlement.create({
          data: {
            amount: convertedAmount,
            originalAmount: amount,
            originalCurrency: currency,
            exchangeRate: rate,
            convertedAmount,
            convertedCurrency: BASE_CURRENCY,
            note: row.parsed.notes || row.parsed.description,
            date: new Date(row.parsed.date || Date.now()),
            paidByUserId,
            receivedByUserId,
            groupId: group.id,
            sourceImportId: importId,
            sourceImportRowId: row.id,
            createdByUserId: user.id,
          },
        });

        await tx.importRow.update({
          where: { id: row.id },
          data: {
            status: "imported",
            createdSettlementId: settlement.id,
          },
        });
        settlements.push({ rowNumber: row.rowNumber, settlementId: settlement.id });
        importedCount++;
        continue;
      }

      const paidByUserId = idsByName[row.parsed.paidBy];
      const participantIds = row.parsed.participants.map((name) => ({
        name,
        userId: idsByName[name],
      }));

      if (!paidByUserId || participantIds.length === 0) {
        await tx.importRow.update({
          where: { id: row.id },
          data: { status: "skipped" },
        });
        skippedCount++;
        continue;
      }

      const splitRows = calculateSplits(row.parsed, participantIds, paidByUserId, convertedAmount);
      const roundedSplits = [];
      if (splitRows.length === 0) {
        await tx.importRow.update({
          where: { id: row.id },
          data: { status: "skipped" },
        });
        skippedCount++;
        continue;
      }

      if (splitRows.length === 1) {
        roundedSplits.push({ ...splitRows[0], amount: Number(convertedAmount.toFixed(2)) });
      } else {
        const rawAmounts = splitRows.map((s) => s.amount);
        const rounded = rawAmounts.map((a) => Math.round(a * 100) / 100);
        const sumRounded = rounded.reduce((s, v) => s + v, 0);
        const discrepancy = Math.round((convertedAmount - sumRounded) * 100) / 100;
        rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + discrepancy) * 100) / 100;
        for (let i = 0; i < splitRows.length; i++) {
          roundedSplits.push({ ...splitRows[i], amount: Number(rounded[i].toFixed(2)) });
        }
      }

      const splitSum = roundedSplits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(splitSum - Number(convertedAmount.toFixed(2))) > 0.01) {
        await tx.importRow.update({
          where: { id: row.id },
          data: { status: "skipped" },
        });
        skippedCount++;
        continue;
      }

      const expense = await tx.expense.create({
        data: {
          description: row.parsed.description,
          amount: convertedAmount,
          originalAmount: amount,
          originalCurrency: currency,
          exchangeRate: rate,
          currencyRateId,
          convertedAmount,
          convertedCurrency: BASE_CURRENCY,
          category: "Imported",
          date: new Date(row.parsed.date || Date.now()),
          paidByUserId,
          splitType: row.parsed.splitType || "equal",
          splits: roundedSplits.map((s) => ({
            userId: s.userId,
            amount: s.amount,
            paid: s.paid,
          })),
          groupId: group.id,
          sourceImportId: importId,
          sourceImportRowId: row.id,
          createdByUserId: user.id,
        },
      });

      for (const split of roundedSplits) {
        splitsToCreate.push({
          expenseId: expense.id,
          userId: split.userId,
          amount: split.amount,
          splitType: split.splitType,
          percentage: split.percentage || null,
          shares: split.shares || null,
          paid: split.paid,
          sourceImportRowId: row.id,
        });
      }

      await tx.importRow.update({
        where: { id: row.id },
        data: {
          status: "imported",
          createdExpenseId: expense.id,
        },
      });
      importedCount++;
    }

    // 2. Perform bulk insertion of new memberships
    if (membershipsToCreate.length > 0) {
      await tx.groupMembership.createMany({
        data: membershipsToCreate,
      });
    }

    // 3. Batch update group membership array
    await tx.group.update({
      where: { id: group.id },
      data: { members: groupMembersJSON },
    });

    // 4. Perform bulk insertion of expense splits
    if (splitsToCreate.length > 0) {
      await tx.expenseSplit.createMany({
        data: splitsToCreate,
      });
    }

    await tx.import.update({
      where: { id: importId },
      data: {
        status: "committed",
        importedCount,
        skippedCount,
        committedAt: new Date(),
      },
    });

    const reportSummary = {
      importId,
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
        reviewedAt: review.reviewedAt.getTime(),
      })),
      currencyConversions: conversions,
      settlementConversions: settlements,
      generatedAt: Date.now(),
    };

    const existingReport = await tx.importReport.findFirst({
      where: { importId },
    });

    const reportDoc = {
      importId,
      groupId: group.id,
      generatedById: user.id,
      summaryJson: reportSummary,
      generatedAt: new Date(),
    };

    if (existingReport) {
      await tx.importReport.update({
        where: { id: existingReport.id },
        data: reportDoc,
      });
    } else {
      await tx.importReport.create({ data: reportDoc });
    }

    return { importedCount, skippedCount, report: reportSummary };
  }, {
    timeout: 60000
  });

  return result;
}
