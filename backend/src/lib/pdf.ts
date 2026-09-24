export interface DocumentTemplateData {
  hospitalName: string;
  documentTitle: string;
  patientName: string;
  patientCode: string;
  date: string;
  items: Array<{ label: string; value: string }>;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
  notes?: string;
  doctorName?: string;
  doctorRegNo?: string;
}

/**
 * Clean textual / HTML representation generator that renders high-fidelity
 * printable layout for browser print/save-as-pdf or direct buffer download.
 */
export function generatePrintableHtml(data: DocumentTemplateData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${data.documentTitle} - ${data.patientCode}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; }
    .header { border-bottom: 2px solid #028090; padding-bottom: 12px; margin-bottom: 20px; }
    .hospital-title { color: #0b2e33; font-size: 22px; font-weight: bold; margin: 0; }
    .doc-title { color: #028090; font-size: 16px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 20px; }
    .table-container { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    .table-container th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; color: #0b2e33; }
    .table-container td { padding: 8px; border: 1px solid #cbd5e1; }
    .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 11px; color: #64748b; }
    .sign-box { margin-top: 30px; text-align: right; }
    @media print {
      body { margin: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="hospital-title">${data.hospitalName}</h1>
    <div class="doc-title">${data.documentTitle}</div>
  </div>

  <div class="meta-grid">
    <div><strong>Patient:</strong> ${data.patientName} (${data.patientCode})</div>
    <div><strong>Date:</strong> ${data.date}</div>
    ${data.items.map((i) => `<div><strong>${i.label}:</strong> ${i.value}</div>`).join('')}
  </div>

  ${
    data.tables
      ? data.tables
          .map(
            (t) => `
    <table class="table-container">
      <thead>
        <tr>${t.headers.map((h) => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${t.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `
          )
          .join('')
      : ''
  }

  ${data.notes ? `<div style="margin-top: 20px; font-size: 13px;"><strong>Notes / Advice:</strong><br/>${data.notes}</div>` : ''}

  ${
    data.doctorName
      ? `
  <div class="sign-box">
    <div style="font-weight: bold;">${data.doctorName}</div>
    <div style="font-size: 12px; color: #475569;">Reg No: ${data.doctorRegNo || 'N/A'}</div>
    <div style="font-size: 11px; color: #64748b;">(Digitally Verified & Locked)</div>
  </div>
  `
      : ''
  }

  <div class="footer">
    CareSmart Hospital System &bull; Transparent, Paperless Healthcare &bull; Generated: ${new Date().toISOString()}
  </div>
</body>
</html>`;
}
