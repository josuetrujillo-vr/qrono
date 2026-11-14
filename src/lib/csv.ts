export function csv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
