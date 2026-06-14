function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

export function detectAmountAnomalies(stagedRows) {
    const results = [];
    for (const row of stagedRows) {
        const p = row.parsed;
        if (p.amount === null) results.push(anomaly(row._id, row.rowNumber, "INVALID_AMOUNT", "blocking", "Amount is not a valid number.", "correct", 0.99));
        else if (p.amount < 0) results.push(anomaly(row._id, row.rowNumber, "NEGATIVE_AMOUNT", "blocking", "Negative amount may be a refund or correction.", "correct", 0.93));
        else if (p.amount === 0) results.push(anomaly(row._id, row.rowNumber, "ZERO_AMOUNT", "warning", "Zero amount expense does not affect balances.", "skip", 0.95));
    }
    return results;
}

export default { detectAmountAnomalies };
