import { Copy, createIcons, Download, FilePlus2, FolderOpen, History, ImagePlus, Plus, ReceiptText, Save, ScanLine, Search, Trash2, Upload } from 'lucide'
import { exportPdf } from './pdf-export.js'
import { parsePurchaseOrder } from './po-parser.js'

const company = { name: 'Metalys Enclosures Manufacturing', address: 'Street 653, Zone 57, Building No. 46', city: 'Industrial Area, Doha', country: 'State of Qatar, PIN 11290' }
const recordsKey = 'metalys-documents-v1'
const settingsKey = 'metalys-settings-v1'
const defaultLogo = `${import.meta.env.BASE_URL}metalys-logo.png`
const today = () => new Date().toISOString().slice(0, 10)
const id = () => crypto.randomUUID()
const item = () => ({ id: id(), description: '', quantity: 1, unit: 'Nos', rate: 0, tax: 0 })
const storedRecords = () => JSON.parse(localStorage.getItem(recordsKey) || '[]')
const nextNumber = (type) => `${type === 'invoice' ? 'INV' : 'PI'}-${new Date().getFullYear()}-${String(storedRecords().filter((record) => record.type === type).length + 1).padStart(4, '0')}`
const fresh = (type = 'proforma') => ({ id: id(), type, number: nextNumber(type), date: today(), poNumber: '', place: 'Doha, Qatar', status: type === 'invoice' ? 'Pending' : 'Draft', customerName: '', customerAddress: '', customerTaxId: '', items: [item()], discount: 0, paymentTerms: 'Payment due within 30 days', notes: type === 'invoice' ? 'Thank you for your business.' : 'This proforma invoice is valid for 30 days.' })
let state = fresh()
let settings = JSON.parse(localStorage.getItem(settingsKey) || '{}')
const icons = { Copy, Download, FilePlus2, FolderOpen, History, ImagePlus, Plus, ReceiptText, Save, ScanLine, Search, Trash2, Upload }

document.querySelector('#app').innerHTML = `
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand"><img src="${defaultLogo}" alt="Metalys"><div><strong>METALYS</strong><small>DOCUMENT STUDIO</small></div></div>
    <nav><button class="nav active" data-type="proforma"><i data-lucide="file-plus-2"></i>Proforma invoices</button><button class="nav" data-type="invoice"><i data-lucide="receipt-text"></i>Tax invoices</button><button class="nav" id="history-open"><i data-lucide="history"></i>Saved documents</button></nav>
    <div class="local"><b></b><span><strong>Stored locally</strong><small>Private to this browser</small></span></div>
  </aside>
  <main>
    <header class="topbar"><div><p id="workspace-label">PROFORMA WORKSPACE</p><h1 id="title">Create proforma invoice</h1></div><div class="actions"><label class="button secondary"><i data-lucide="scan-line"></i>Import PO<input id="po-file" type="file" accept=".pdf,application/pdf" hidden></label><button class="button secondary" id="convert"><i data-lucide="receipt-text"></i>Convert to invoice</button><button class="button secondary" id="save"><i data-lucide="save"></i>Save</button><button class="button primary" id="download"><i data-lucide="download"></i>Download PDF</button></div></header>
    <section class="workspace">
      <section class="panel"><header><div><span>01</span><h2>Document details</h2></div><em id="number-badge"></em></header><div class="fields three"><label>Document number<input data-field="number"></label><label>Issue date<input data-field="date" type="date"></label><label>Place<input data-field="place" readonly></label><label>Customer company<input data-field="customerName" placeholder="Company legal name"></label><label>PO number<input data-field="poNumber" placeholder="Customer PO reference"></label><label>Status<select data-field="status" id="status"></select></label><label class="wide">Customer address<textarea data-field="customerAddress" rows="2" placeholder="Street, city, country"></textarea></label><label>Tax ID / CR<input data-field="customerTaxId" placeholder="Optional"></label></div></section>
      <section class="panel"><header><div><span>02</span><h2>Materials & order details</h2></div><button class="icon-button add" title="Add line item"><i data-lucide="plus"></i></button></header><div class="table-scroll"><table class="item-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate (QAR)</th><th>Tax %</th><th>Amount</th><th></th></tr></thead><tbody id="items"></tbody></table></div><button class="add-line add"><i data-lucide="plus"></i>Add another item</button></section>
      <section class="panel"><header><div><span>03</span><h2>Terms & adjustments</h2></div></header><div class="fields two"><label>Payment terms<input data-field="paymentTerms"></label><label>Discount (QAR)<input data-field="discount" type="number" min="0" step="0.01"></label><label class="wide">Notes<textarea data-field="notes" rows="2"></textarea></label></div></section>
    </section>
  </main>
  <aside class="preview"><div class="preview-bar"><span>LIVE PREVIEW <b>A4</b></span><label title="Upload logo"><i data-lucide="image-plus"></i><input id="logo-file" type="file" accept="image/*" hidden></label></div><div class="paper-wrap"><article id="paper"></article></div></aside>
</div>
<dialog id="history"><header><div><p>DOCUMENT TRACKER</p><h2>Invoice history</h2></div><button id="history-close" aria-label="Close">×</button></header><section class="history-summary" id="history-summary"></section><section class="history-tools"><label class="history-search"><i data-lucide="search"></i><input id="history-search" placeholder="Search number, customer or PO"></label><select id="history-type" aria-label="Filter document type"><option value="all">All documents</option><option value="invoice">Tax invoices</option><option value="proforma">Proforma invoices</option></select><select id="history-status" aria-label="Filter status"><option value="all">All statuses</option><option>Draft</option><option>Sent</option><option>Accepted</option><option>Pending</option><option>Paid</option><option>Overdue</option></select><button class="history-tool" id="history-export" title="Download history backup"><i data-lucide="download"></i>Backup</button><label class="history-tool" title="Restore history backup"><i data-lucide="upload"></i>Restore<input id="history-import" type="file" accept="application/json,.json" hidden></label></section><div class="history-columns"><span>Document</span><span>Customer</span><span>Status</span><span>Total</span><span>Date</span><span></span></div><div id="history-list"></div></dialog><div id="toast"></div>`
createIcons({ icons })

const escape = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const money = (value) => new Intl.NumberFormat('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)
const totals = () => {
  const subtotal = state.items.reduce((sum, row) => sum + row.quantity * row.rate, 0)
  const tax = state.items.reduce((sum, row) => sum + row.quantity * row.rate * row.tax / 100, 0)
  return { subtotal, tax, total: Math.max(0, subtotal + tax - Number(state.discount || 0)) }
}
const documentTotal = (record) => {
  const rows = Array.isArray(record.items) ? record.items : []
  const subtotal = rows.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.rate || 0), 0)
  const tax = rows.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.rate || 0) * Number(row.tax || 0) / 100, 0)
  return Math.max(0, subtotal + tax - Number(record.discount || 0))
}
let toastTimer
const notify = (message) => {
  const toast = document.querySelector('#toast')
  clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.add('show')
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400)
}

function renderItems() {
  document.querySelector('#items').innerHTML = state.items.map((row, index) => `<tr data-index="${index}"><td><textarea data-item="description" rows="1" placeholder="Material or service">${escape(row.description)}</textarea></td><td><input data-item="quantity" type="number" min="0" step="0.01" value="${row.quantity}"></td><td><input data-item="unit" value="${escape(row.unit)}"></td><td><input data-item="rate" type="number" min="0" step="0.01" value="${row.rate}"></td><td><input data-item="tax" type="number" min="0" step="0.01" value="${row.tax}"></td><td class="row-total">${money(row.quantity * row.rate * (1 + row.tax / 100))}</td><td><button class="remove" title="Remove item" ${state.items.length === 1 ? 'disabled' : ''}><i data-lucide="trash-2"></i></button></td></tr>`).join('')
  createIcons({ icons })
}

function renderPaper() {
  const sum = totals()
  const invoice = state.type === 'invoice'
  const logo = settings.logo || defaultLogo
  const logoMarkup = `<img class="company-logo" src="${logo}" alt="Metalys logo">`
  document.querySelector('#paper').innerHTML = `<header class="paper-head">${logoMarkup}<div><strong>${company.name}</strong><span>${company.address}</span><span>${company.city}</span><span>${company.country}</span></div></header><section class="document-head"><div><span>${invoice ? 'OFFICIAL COMMERCIAL DOCUMENT' : 'QUOTATION / ESTIMATE'}</span><h2>${invoice ? 'TAX INVOICE' : 'PROFORMA INVOICE'}</h2></div><div><strong>${escape(state.number)}</strong><span>${escape(state.status)}</span></div></section><section class="parties"><div><small>BILL TO</small><strong>${escape(state.customerName) || 'Customer company'}</strong><p>${escape(state.customerAddress).replace(/\n/g, '<br>') || 'Customer address'}</p>${state.customerTaxId ? `<p>Tax ID / CR: ${escape(state.customerTaxId)}</p>` : ''}</div><dl><dt>Issue date</dt><dd>${escape(state.date)}</dd><dt>PO number</dt><dd>${escape(state.poNumber) || '—'}</dd><dt>Place</dt><dd>Doha, Qatar</dd></dl></section><table class="paper-table"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Tax</th><th>Amount (QAR)</th></tr></thead><tbody>${state.items.map((row, index) => `<tr><td>${index + 1}</td><td>${escape(row.description) || 'Material / service'}</td><td>${money(row.quantity)}</td><td>${escape(row.unit)}</td><td>${money(row.rate)}</td><td>${money(row.tax)}%</td><td>${money(row.quantity * row.rate * (1 + row.tax / 100))}</td></tr>`).join('')}</tbody></table><section class="paper-bottom"><div class="terms"><small>PAYMENT TERMS</small><p>${escape(state.paymentTerms)}</p><small>NOTES</small><p>${escape(state.notes).replace(/\n/g, '<br>')}</p>${invoice ? '' : '<div>This document is a proforma invoice and not a demand for payment.</div>'}</div><div class="summary"><p><span>Subtotal</span><b>QAR ${money(sum.subtotal)}</b></p><p><span>Tax</span><b>QAR ${money(sum.tax)}</b></p><p><span>Discount</span><b>QAR ${money(state.discount)}</b></p><p><span>Grand total</span><b>QAR ${money(sum.total)}</b></p></div></section><footer><span>Metalys Enclosures Manufacturing</span><span>Doha, State of Qatar</span><span>Page 1 of 1</span></footer>`
}

function populate() {
  const statuses = state.type === 'invoice' ? ['Pending', 'Paid', 'Overdue'] : ['Draft', 'Sent', 'Accepted']
  document.querySelector('#status').innerHTML = statuses.map((status) => `<option>${status}</option>`).join('')
  document.querySelectorAll('[data-field]').forEach((input) => { input.value = state[input.dataset.field] ?? '' })
  document.querySelector('#number-badge').textContent = state.number
  document.querySelector('#convert').hidden = state.type === 'invoice'
  renderItems(); renderPaper()
}

function switchType(type, source) {
  const previous = state
  state = fresh(type)
  if (source) state = { ...state, customerName: previous.customerName, customerAddress: previous.customerAddress, customerTaxId: previous.customerTaxId, poNumber: previous.poNumber, items: previous.items, discount: previous.discount, paymentTerms: previous.paymentTerms, notes: `Converted from ${previous.number}` }
  document.querySelectorAll('.nav[data-type]').forEach((button) => button.classList.toggle('active', button.dataset.type === type))
  document.querySelector('#workspace-label').textContent = type === 'invoice' ? 'TAX INVOICE WORKSPACE' : 'PROFORMA WORKSPACE'
  document.querySelector('#title').textContent = type === 'invoice' ? 'Create tax invoice' : 'Create proforma invoice'
  populate()
}

function saveDocument(showNotification = true) {
  const records = storedRecords()
  const index = records.findIndex((record) => record.id === state.id)
  const now = new Date().toISOString()
  const saved = { ...state, createdAt: state.createdAt || now, updatedAt: now }
  state = saved
  index < 0 ? records.unshift(saved) : records.splice(index, 1, saved)
  localStorage.setItem(recordsKey, JSON.stringify(records.slice(0, 500)))
  if (showNotification) notify('Document saved to history')
}

function renderHistory() {
  const records = storedRecords()
  const query = document.querySelector('#history-search').value.trim().toLowerCase()
  const type = document.querySelector('#history-type').value
  const status = document.querySelector('#history-status').value
  const invoices = records.filter((record) => record.type === 'invoice')
  const outstanding = invoices.filter((record) => ['Pending', 'Overdue'].includes(record.status)).reduce((sum, record) => sum + documentTotal(record), 0)
  document.querySelector('#history-summary').innerHTML = `<div><small>ALL DOCUMENTS</small><strong>${records.length}</strong></div><div><small>TAX INVOICES</small><strong>${invoices.length}</strong></div><div><small>PROFORMAS</small><strong>${records.length - invoices.length}</strong></div><div><small>OUTSTANDING</small><strong>QAR ${money(outstanding)}</strong></div>`
  const filtered = records.filter((record) => {
    const searchable = `${record.number || ''} ${record.customerName || ''} ${record.poNumber || ''}`.toLowerCase()
    return (!query || searchable.includes(query)) && (type === 'all' || record.type === type) && (status === 'all' || record.status === status)
  })
  document.querySelector('#history-list').innerHTML = filtered.length ? filtered.map((record) => {
    const statuses = record.type === 'invoice' ? ['Pending', 'Paid', 'Overdue'] : ['Draft', 'Sent', 'Accepted']
    return `<div class="history-row" data-id="${record.id}"><div class="history-document"><em>${record.type === 'invoice' ? 'INV' : 'PI'}</em><span><strong>${escape(record.number)}</strong><small>${escape(record.poNumber) || 'No PO reference'}</small></span></div><div class="history-customer">${escape(record.customerName) || 'Unnamed customer'}</div><select class="history-status status-${escape(record.status).toLowerCase()}" data-history-status>${statuses.map((value) => `<option ${value === record.status ? 'selected' : ''}>${value}</option>`).join('')}</select><strong class="history-total">QAR ${money(documentTotal(record))}</strong><time>${record.date || '—'}</time><div class="history-actions"><button data-action="open" title="Open document"><i data-lucide="folder-open"></i></button><button data-action="duplicate" title="Duplicate document"><i data-lucide="copy"></i></button><button data-action="delete" title="Delete document"><i data-lucide="trash-2"></i></button></div></div>`
  }).join('') : '<div class="empty">No documents match these filters.</div>'
  createIcons({ icons })
}

function openHistoryRecord(record) {
  state = structuredClone(record)
  document.querySelectorAll('.nav[data-type]').forEach((button) => button.classList.toggle('active', button.dataset.type === state.type))
  document.querySelector('#workspace-label').textContent = state.type === 'invoice' ? 'TAX INVOICE WORKSPACE' : 'PROFORMA WORKSPACE'
  document.querySelector('#title').textContent = state.type === 'invoice' ? 'Edit tax invoice' : 'Edit proforma invoice'
  populate()
  document.querySelector('#history').close()
}

document.querySelectorAll('[data-field]').forEach((input) => input.addEventListener('input', (event) => { state[event.target.dataset.field] = event.target.type === 'number' ? Number(event.target.value) : event.target.value; document.querySelector('#number-badge').textContent = state.number; renderPaper() }))
document.querySelector('#items').addEventListener('input', (event) => { const row = event.target.closest('tr'); const key = event.target.dataset.item; if (!row || !key) return; state.items[row.dataset.index][key] = ['quantity', 'rate', 'tax'].includes(key) ? Number(event.target.value) : event.target.value; row.querySelector('.row-total').textContent = money(state.items[row.dataset.index].quantity * state.items[row.dataset.index].rate * (1 + state.items[row.dataset.index].tax / 100)); renderPaper() })
document.querySelector('#items').addEventListener('click', (event) => { const button = event.target.closest('.remove'); if (!button) return; state.items.splice(button.closest('tr').dataset.index, 1); renderItems(); renderPaper() })
document.querySelectorAll('.add').forEach((button) => button.addEventListener('click', () => { state.items.push(item()); renderItems(); renderPaper() }))
document.querySelectorAll('.nav[data-type]').forEach((button) => button.addEventListener('click', () => switchType(button.dataset.type)))
document.querySelector('#convert').addEventListener('click', () => { switchType('invoice', true); notify('Converted to a new tax invoice') })
document.querySelector('#save').addEventListener('click', () => saveDocument())
document.querySelector('#download').addEventListener('click', async () => {
  const button = document.querySelector('#download')
  const originalContent = button.innerHTML
  const integratedBrowser = /Electron|\bCode\//.test(navigator.userAgent)
  if (integratedBrowser) {
    navigator.clipboard?.writeText(location.href).catch(() => {})
    notify('VS Code preview blocks downloads. Open this link in Safari or Chrome.')
    return
  }
  button.disabled = true
  button.textContent = 'Generating PDF…'
  try {
    await exportPdf(document.querySelector('#paper'), `${state.number}.pdf`)
    saveDocument(false)
    notify('PDF download started and added to history')
  } catch (error) {
    console.error(error)
    notify('PDF download failed')
  } finally {
    button.disabled = false
    button.innerHTML = originalContent
    createIcons({ icons })
  }
})
document.querySelector('#logo-file').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { settings.logo = reader.result; localStorage.setItem(settingsKey, JSON.stringify(settings)); renderPaper(); notify('Logo saved') }; reader.readAsDataURL(file) })
document.querySelector('#po-file').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; notify('Extracting purchase order…'); try { const result = await parsePurchaseOrder(file, notify); switchType('invoice'); state = { ...state, ...result, items: result.items.length ? result.items : state.items }; populate(); notify(`${result.extractionMode === 'ocr' ? 'Scanned PO recognized' : 'PO imported'}. Review ${result.items.length} detected item(s).`) } catch (error) { notify(error.message); console.error(error) } event.target.value = '' })
document.querySelector('#history-open').addEventListener('click', () => { renderHistory(); document.querySelector('#history').showModal() })
document.querySelector('#history-close').addEventListener('click', () => document.querySelector('#history').close())
document.querySelectorAll('#history-search, #history-type, #history-status').forEach((control) => control.addEventListener('input', renderHistory))
document.querySelector('#history-list').addEventListener('change', (event) => { if (!event.target.matches('[data-history-status]')) return; const records = storedRecords(); const record = records.find((entry) => entry.id === event.target.closest('[data-id]').dataset.id); record.status = event.target.value; record.updatedAt = new Date().toISOString(); localStorage.setItem(recordsKey, JSON.stringify(records)); if (state.id === record.id) { state.status = record.status; populate() } renderHistory(); notify('Status updated') })
document.querySelector('#history-list').addEventListener('click', (event) => { const button = event.target.closest('[data-action]'); if (!button) return; const recordId = button.closest('[data-id]').dataset.id; const records = storedRecords(); const record = records.find((entry) => entry.id === recordId); if (button.dataset.action === 'open') openHistoryRecord(record); if (button.dataset.action === 'duplicate') { const duplicate = structuredClone(record); duplicate.id = id(); duplicate.number = nextNumber(duplicate.type); duplicate.date = today(); duplicate.status = duplicate.type === 'invoice' ? 'Pending' : 'Draft'; duplicate.createdAt = new Date().toISOString(); duplicate.updatedAt = duplicate.createdAt; duplicate.items = duplicate.items.map((row) => ({ ...row, id: id() })); records.unshift(duplicate); localStorage.setItem(recordsKey, JSON.stringify(records.slice(0, 500))); renderHistory(); notify(`Created ${duplicate.number}`) } if (button.dataset.action === 'delete' && confirm(`Delete ${record.number}? This cannot be undone.`)) { localStorage.setItem(recordsKey, JSON.stringify(records.filter((entry) => entry.id !== recordId))); renderHistory(); notify('Document deleted') } })
document.querySelector('#history-export').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), documents: storedRecords() }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `metalys-invoice-history-${today()}.json`; link.click(); URL.revokeObjectURL(link.href); notify('History backup downloaded') })
document.querySelector('#history-import').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; try { const data = JSON.parse(await file.text()); const incoming = Array.isArray(data) ? data : data.documents; if (!Array.isArray(incoming) || incoming.some((record) => !record.id || !record.type || !Array.isArray(record.items))) throw new Error('Invalid backup file'); const merged = new Map(storedRecords().map((record) => [record.id, record])); incoming.forEach((record) => merged.set(record.id, record)); localStorage.setItem(recordsKey, JSON.stringify([...merged.values()].slice(0, 500))); renderHistory(); notify(`${incoming.length} document(s) restored`) } catch (error) { notify(error.message) } event.target.value = '' })

populate()