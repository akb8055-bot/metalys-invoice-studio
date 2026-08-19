import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function exportPdf(element, filename) {
  const canvas = await html2canvas(element, { scale: 2.4, useCORS: true, backgroundColor: '#fff', logging: false })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
  const blob = pdf.output('blob')
  if ('showSaveFilePicker' in window) {
    const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }] })
    const stream = await handle.createWritable()
    await stream.write(blob)
    await stream.close()
  } else {
    pdf.save(filename)
  }
}