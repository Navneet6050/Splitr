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
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

export function detectDuplicateAnomalies(stagedRows) {
    const results = [];
    for (let i = 0; i < stagedRows.length; i++) {
        for (let j = i + 1; j < stagedRows.length; j++) {
            const a = stagedRows[i].parsed;
            const b = stagedRows[j].parsed;
            if (!a.date || !b.date || a.amount === null || b.amount === null) continue;
            const sameDate = a.date === b.date;
            const samePayer = a.paidBy && a.paidBy === b.paidBy;
            const sameAmount = Math.abs(a.amount - b.amount) < 0.01;
            const similar = similarity(a.description, b.description);

            if (sameDate && samePayer && sameAmount && similar >= 0.45) {
                results.push(anomaly(stagedRows[j]._id, stagedRows[j].rowNumber, "DUPLICATE_EXPENSE", "blocking", `Likely duplicate of row ${stagedRows[i].rowNumber}.`, "skip", 0.92, { duplicateOfRowNumber: stagedRows[i].rowNumber }));
            } else if (sameDate && similar >= 0.5 && Math.abs(a.amount - b.amount) <= 100) {
                results.push(anomaly(stagedRows[j]._id, stagedRows[j].rowNumber, "NEAR_DUPLICATE_EXPENSE", "warning", `May duplicate row ${stagedRows[i].rowNumber} with a different amount.`, "correct", 0.72, { duplicateOfRowNumber: stagedRows[i].rowNumber }));
            }
        }
    }
    return results;
}

export default { detectDuplicateAnomalies };
