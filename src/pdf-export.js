import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function exportPdf(element, filename) {
  const targetLongEdge = 4096
  const scale = targetLongEdge / element.getBoundingClientRect().height
  const canvas = await html2canvas(element, { scale, useCORS: true, backgroundColor: '#fff', logging: false })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'SLOW')
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return { width: canvas.width, height: canvas.height, bytes: blob.size }
}