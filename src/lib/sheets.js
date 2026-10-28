// Excel / CSV reading and writing for the bulk imports. The xlsx library is
// large, so it loads only when someone opens an import.
const load = () => import('xlsx')

// Rows keyed by the header row. CSV stays as text so 05/10/2026 is read day
// first (the parser would guess month first); Excel dates come back as Dates.
export async function readSheet(file) {
  const XLSX = await load()
  const csv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  const wb = csv
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: !csv })
}

function save(XLSX, wb, fileName, format) {
  XLSX.writeFile(wb, `${fileName}.${format}`, { bookType: format, compression: true })
}

const widths = rows => rows[0].map((_, c) => ({ wch: Math.min(60, Math.max(12, ...rows.map(r => String(r[c] ?? '').length + 2))) }))

// Template: header + example rows; the Excel version adds a "How to fill" sheet
// and, when given, a list of allowed values (for example project names).
export async function downloadTemplate(template, format = 'xlsx', lists = []) {
  const XLSX = await load()
  const wb = XLSX.utils.book_new()
  const data = [template.columns, ...template.sample]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = widths(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Fill this in')
  if (format === 'xlsx') {
    const help = [['Column', 'How to fill'], ...template.help, [], ['Delete the example rows before importing.']]
    lists.forEach(l => help.push([], [l.title], ...l.values.map(v => [v])))
    const hs = XLSX.utils.aoa_to_sheet(help)
    hs['!cols'] = [{ wch: 18 }, { wch: 70 }]
    XLSX.utils.book_append_sheet(wb, hs, 'How to fill')
  }
  save(XLSX, wb, template.name, format)
}

// Any table as a download, e.g. the sign in details after a people import.
export async function downloadRows(fileName, header, rows) {
  const XLSX = await load()
  const wb = XLSX.utils.book_new()
  const data = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = widths(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  save(XLSX, wb, fileName, 'xlsx')
}

// A report as an Excel workbook (one sheet per entry) or, for CSV, the first
// sheet only. sheets: [{ title, rows: [[header...], [cells...], ...] }]
export async function downloadWorkbook(fileName, sheets, format = 'xlsx') {
  const XLSX = await load()
  const wb = XLSX.utils.book_new()
  ;(format === 'csv' ? sheets.slice(0, 1) : sheets).forEach(({ title, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    // Size columns by the widest row (the first may be a one cell title).
    const wide = rows.reduce((a, r) => (r.length > a.length ? r : a), [])
    ws['!cols'] = widths([wide, ...rows])
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  })
  save(XLSX, wb, fileName, format)
}
