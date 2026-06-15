// CSV export helpers. toCSV is pure (tested); downloadCSV touches the DOM.

const needsQuoting = /[",\n]/

function escapeCell(value) {
  const str = value == null ? '' : String(value)
  return needsQuoting.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

// rows: [{ key: value }], columns: [{ key, label }] -> CSV string
export function toCSV(rows, columns) {
  const header = columns.map(c => escapeCell(c.label)).join(',')
  if (!rows.length) return header
  const body = rows
    .map(row => columns.map(c => escapeCell(row[c.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

export function downloadCSV(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
