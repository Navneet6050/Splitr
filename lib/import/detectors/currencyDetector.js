function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

const BASE_CURRENCY = "INR";

export function detectCurrencyAnomalies(stagedRows) {
    const results = [];
    for (const row of stagedRows) {
        const p = row.parsed;
        if (!p.currency) {
            results.push(anomaly(row._id, row.rowNumber, "MISSING_CURRENCY", "blocking", "The row has no currency.", "correct", 0.99));
        } else if (p.currency !== BASE_CURRENCY) {
            results.push(anomaly(row._id, row.rowNumber, "CURRENCY_CONVERSION_REQUIRED", "warning", `${p.currency} must be converted to ${BASE_CURRENCY}.`, "convert", 0.99, { fromCurrency: p.currency, toCurrency: BASE_CURRENCY }));
        }
    }
    return results;
}

export default { detectCurrencyAnomalies };
