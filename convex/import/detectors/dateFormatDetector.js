function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

export function detectDateAnomalies(stagedRows) {
    const results = [];
    const dateFormats = new Set(stagedRows.map((r) => r.parsed.dateFormat).filter(Boolean));

    for (const row of stagedRows) {
        const p = row.parsed;
        if (!p.date) results.push(anomaly(row._id, row.rowNumber, "INVALID_DATE", "blocking", "Date could not be parsed.", "correct", 0.98));
        if (p.ambiguousDate) results.push(anomaly(row._id, row.rowNumber, "AMBIGUOUS_DATE", "blocking", `Date '${p.dateRaw}' can be read in more than one format.`, "correct", 0.9));
    }
    if (dateFormats.size > 1) {
        // attach a single import-level warning by mapping to first row
        const sampleRow = stagedRows[0];
        if (sampleRow)
            results.push(anomaly(sampleRow._id, sampleRow.rowNumber, "MIXED_DATE_FORMAT", "warning", "The import uses multiple date formats.", "approve", 0.8, { detectedFormats: [...dateFormats] }));
    }
    return results;
}

export default { detectDateAnomalies };
