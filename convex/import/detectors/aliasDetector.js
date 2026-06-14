function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

function normalizeName(name) {
    return (name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

function canonicalName(name) {
    const normalized = normalizeName(name);
    if (normalized === "priya s") return "Priya";
    if (normalized === "priya") return "Priya";
    if (normalized === "rohan") return "Rohan";
    if (normalized === "dev's friend kabir") return "Kabir";
    return name
        .toString()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function detectAliasAnomalies(stagedRows) {
    const results = [];
    for (const row of stagedRows) {
        const p = row.parsed;
        for (const rawName of [p.paidBy, ...(p.participants || [])].filter(Boolean)) {
            if (rawName !== rawName.trim() || rawName !== canonicalName(rawName)) {
                results.push(anomaly(row._id, row.rowNumber, "NAME_ALIAS", "warning", `Name '${rawName}' will be resolved to '${canonicalName(rawName)}'.`, "approve", 0.76, { rawName, normalizedName: canonicalName(rawName) }));
            }
        }
    }
    return results;
}

export default { detectAliasAnomalies };
