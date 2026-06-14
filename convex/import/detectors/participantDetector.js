function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

export function detectParticipantAnomalies(stagedRows) {
    const results = [];
    for (const row of stagedRows) {
        const p = row.parsed;
        if ((p.participants || []).length === 0 && !/(paid.*back|settlement|settle|transfer|repaid)/i.test(p.description)) {
            results.push(anomaly(row._id, row.rowNumber, "INVALID_PARTICIPANT_COUNT", "blocking", "Expense has no split participants.", "correct", 0.98));
        }
        if (/(paid.*back|settlement|settle|transfer|repaid|refund)/i.test(`${p.description} ${p.notes}`)) {
            results.push(anomaly(row._id, row.rowNumber, "SETTLEMENT_LOGGED_AS_EXPENSE", "blocking", "This row looks like a repayment rather than an expense.", "convert", 0.86));
        }
    }
    return results;
}

export default { detectParticipantAnomalies };
