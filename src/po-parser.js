import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const clean = (value = '') => value.replace(/\s+/g, ' ').trim()

async function extractTextLines(pdf) {
  const lines = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const rows = new Map()
    content.items.forEach((item) => {
      const row = Math.round(item.transform[5] / 3) * 3
      rows.set(row, [...(rows.get(row) || []), item])
    })
    ;[...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
      lines.push(clean(items.sort((a, b) => a.transform[4] - b.transform[4]).map((item) => item.str).join(' ')))
    })
  }
  return lines.filter(Boolean)
}

async function recognizeScannedPages(pdf, onProgress) {
  const { createWorker } = await import('tesseract.js')
  let activePage = 1
  onProgress('Scanned PO detected. Starting OCR…')
  const worker = await createWorker('eng', 1, {
    langPath: `${import.meta.env.BASE_URL}tessdata`,
    logger: ({ status, progress }) => {
      if (status === 'recognizing text') onProgress(`Reading scanned page ${activePage} of ${pdf.numPages} · ${Math.round(progress * 100)}%`)
    },
  })
  const lines = []
  try {
    for (activePage = 1; activePage <= pdf.numPages; activePage += 1) {
      const page = await pdf.getPage(activePage)
      const viewport = page.getViewport({ scale: 2.4 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      await page.render({ canvasContext: context, viewport }).promise
      const result = await worker.recognize(canvas)
      lines.push(...result.data.text.split(/\r?\n/).map(clean).filter(Boolean))
      canvas.width = 1
      canvas.height = 1
    }
  } finally {
    await worker.terminate()
  }
  return lines
}

async function extractWordLines(file, onProgress) {
  onProgress('Reading Word purchase order…')
  const mammothModule = await import('mammoth')
  const mammoth = mammothModule.default || mammothModule
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  const documentRoot = new DOMParser().parseFromString(result.value, 'text/html')
  return [...documentRoot.querySelectorAll('p, tr')].map((element) => {
    if (element.matches('tr')) return clean([...element.querySelectorAll('th, td')].map((cell) => cell.textContent).join(' '))
    if (element.closest('tr')) return ''
    return clean(element.textContent)
  }).filter(Boolean)
}

function mapPurchaseOrder(lines, extractionMode, onProgress) {
  const text = lines.join('\n')
  if (text.replace(/\s/g, '').length < 20) throw new Error('No readable PO text was found. Try a clearer file or enter the details manually.')
  onProgress('Mapping purchase order fields…')
  const poNumber = text.match(/(?:\bpurchase\s*order\b|\bp\.?\s*o\.?\b)(?:\s*(?:no|number|#|ref(?:erence)?))?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{2,})/i)?.[1] || ''
  const dateMatch = text.match(/(?:po\s*)?date\s*[:#-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/i)
  const date = dateMatch ? `${dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : new Date().toISOString().slice(0, 10)
  const customerName = lines.find((line, index) => index < 25 && /(?:llc|wll|w\.l\.l|ltd|limited|company|trading|contracting|industries)/i.test(line) && !/metalys/i.test(line)) || ''
  const items = []
  const itemPattern = /^(?:\d+\s+)?(.{4,80}?)\s+(\d+(?:\.\d+)?)\s+(Nos?|Pcs?|Ea|Each|Set|Lot|Mtr|M|Kg)\s+(\d[\d,]*(?:\.\d{1,2})?)(?:\s+\d[\d,]*(?:\.\d{1,2})?)?$/i
  lines.forEach((line) => {
    const match = line.match(itemPattern)
    if (match) items.push({ id: crypto.randomUUID(), description: match[1].trim(), quantity: Number(match[2]), unit: match[3], rate: Number(match[4].replace(/,/g, '')), tax: 0 })
  })
  return { poNumber, date, customerName, items, extractionMode }
}

export async function parsePurchaseOrder(file, onProgress = () => {}) {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.doc')) throw new Error('Legacy .doc files are not supported. Open the file in Word and save it as .docx, then import it again.')
  if (fileName.endsWith('.docx')) {
    const lines = await extractWordLines(file, onProgress)
    return mapPurchaseOrder(lines, 'word', onProgress)
  }
  if (!fileName.endsWith('.pdf') && file.type !== 'application/pdf') throw new Error('Please upload a PDF or DOCX purchase order.')

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  onProgress('Checking PDF text…')
  let lines = await extractTextLines(pdf)
  let extractionMode = 'text'
  if (lines.join('').length < 30) {
    extractionMode = 'ocr'
    lines = await recognizeScannedPages(pdf, onProgress)
  }
  return mapPurchaseOrder(lines, extractionMode, onProgress)
}