function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

export function detectSplitTypeAnomalies(stagedRows) {
    const results = [];
    for (const row of stagedRows) {
        const p = row.parsed;
        if (["share", "unequal"].includes(p.splitType)) {
            results.push(anomaly(row._id, row.rowNumber, "NON_STANDARD_SPLIT_TYPE", "warning", `Split type '${p.splitType}' requires import-time transformation.`, "approve", 0.9));
        } else if (!["equal", "percentage", "exact", ""].includes(p.splitType)) {
            results.push(anomaly(row._id, row.rowNumber, "UNKNOWN_SPLIT_TYPE", "blocking", `Split type '${p.splitType}' is not supported.`, "correct", 0.98));
        }
    }
    return results;
}

export default { detectSplitTypeAnomalies };
