"use client";
import React from "react";

export default function CsvDropzone({ onChange }) {
    async function handleFile(e) {
        const f = e.target.files[0];
        if (!f) return;
        const text = await f.text();
        onChange(text, f.name);
    }

    return (
        <div>
            <label className="block mb-2">Upload CSV file</label>
            <input type="file" accept="text/csv,text/plain" onChange={handleFile} />
            <div className="mt-3">
                <label className="block mb-1">Or paste CSV</label>
                <textarea
                    rows={10}
                    className="w-full p-2 border rounded"
                    onChange={(e) => onChange(e.target.value, "pasted.csv")}
                />
            </div>
        </div>
    );
}
