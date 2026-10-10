export const DISCLAIMER =
  "SIMULATED DATA - BIOREFINE AI hackathon demonstration. Not certified industrial control software. Not validated against real plant data.";

function esc(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: unknown[][]) {
  return [`# ${DISCLAIMER}`, `# Exported ${new Date().toISOString()}`, headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
