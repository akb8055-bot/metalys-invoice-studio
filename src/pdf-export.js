import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function exportPdf(element, filename) {
  const canvas = await html2canvas(element, { scale: 2.4, useCORS: true, backgroundColor: '#fff', logging: false })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
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
}