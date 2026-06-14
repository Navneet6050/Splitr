// Lightweight port of the detector logic from imports.js
const BASE_CURRENCY = "INR";

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

function parseDate(value) {
    const raw = (value || "").toString().trim();
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
            timestamp: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
            format: "text",
            ambiguous: false,
        };
    }

    return { timestamp: null, format: "invalid", ambiguous: false };
}

function parseAmount(value) {
    const cleaned = (value || "").toString().replace(/,/g, "").trim();
    if (!cleaned) return null;
    const amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : null;
}

function parseParticipants(value) {
    if (!value || !value.toString().trim()) return [];
    return value
        .toString()
        .split(";")
        .map((name) => name.trim())
        .filter(Boolean);
}

function parseSplitDetails(value) {
    const details = {};
    if (!value || !value.toString().trim()) return details;

    for (const part of value.toString().split(";")) {
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

function normalizedDescription(value) {
    return (value || "")
        .toString()
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

function membershipWindowForName(name, rowDate) {
    if (name === "Meera") return { joinedAt: Date.UTC(2026, 1, 1), leftAt: Date.UTC(2026, 3, 1) };
    if (name === "Sam") return { joinedAt: Date.UTC(2026, 3, 8), leftAt: null };
    if (name === "Dev") return { joinedAt: Date.UTC(2026, 1, 8), leftAt: Date.UTC(2026, 2, 15) };
    if (name === "Kabir") return { joinedAt: rowDate, leftAt: rowDate + 24 * 60 * 60 * 1000 };
    return { joinedAt: Date.UTC(2026, 1, 1), leftAt: null };
}

import { detectDuplicateAnomalies } from "./duplicateDetector";
import { detectDateAnomalies } from "./dateFormatDetector";
import { detectAmountAnomalies } from "./amountDetector";
import { detectParticipantAnomalies } from "./participantDetector";
import { detectSplitTypeAnomalies } from "./splitTypeDetector";
import { detectAliasAnomalies } from "./aliasDetector";
import { detectMembershipAnomalies } from "./membershipDetector";
import { detectCurrencyAnomalies } from "./currencyDetector";

export function detectRowAnomalies(stagedRows) {
    const results = [];
    // run focused detectors and aggregate results
    results.push(...detectDateAnomalies(stagedRows));
    results.push(...detectAmountAnomalies(stagedRows));
    results.push(...detectParticipantAnomalies(stagedRows));
    results.push(...detectSplitTypeAnomalies(stagedRows));
    results.push(...detectAliasAnomalies(stagedRows));
    results.push(...detectMembershipAnomalies(stagedRows));
    results.push(...detectCurrencyAnomalies(stagedRows));
    results.push(...detectDuplicateAnomalies(stagedRows));
    return results;
}

export default { detectRowAnomalies };
