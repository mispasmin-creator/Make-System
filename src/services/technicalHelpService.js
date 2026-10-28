import { callGoogleAppsScript } from './dataService';
import { isGoogleSheetsConnected } from '../config/integrationConfig';
import { sortNewestFirst } from '../utils/sortUtils';

const KEY = 'make_system_technical_help_v1';
const readLocal = () => { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const listeners = new Set();
let memory = readLocal();
let revision = 0;
let inFlight = null;
const saveLocal = (v) => {
  memory = v;
  revision++;
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* Memory remains available if browser storage is full. */ }
  listeners.forEach(listener => listener(memory));
};

export const getCachedTechnicalTickets = () => memory;
// Called when a different person signs in or out, so one user's tickets are never shown to the next user.
export function clearTechnicalCache() {
  memory = [];
  revision++;
  try { localStorage.removeItem(KEY); } catch { /* Storage unavailable: memory is already cleared. */ }
  listeners.forEach(listener => listener(memory));
}
export function subscribeTechnicalTickets(listener) {
  listeners.add(listener);
  const onStorage = event => { if (event.key === KEY) { memory = readLocal(); revision++; listener(memory); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export async function listTechnicalTickets() {
  if (!isGoogleSheetsConnected()) return memory;
  if (inFlight) return inFlight;
  const startedAtRevision = revision;
  inFlight = (async () => {
    const res = await callGoogleAppsScript('getTechnicalTickets', {}, 'GET');
    if (!Array.isArray(res.tickets)) throw new Error('Unable to read technical tickets. Check the Apps Script deployment.');
    // A read started before a successful write must not revert that write.
    if (revision === startedAtRevision) saveLocal(sortNewestFirst(res.tickets, 'createdAt', 'ticketNo'));
    return memory;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export async function createTechnicalTicket(data) {
  const ticket = { ...data, id: `th-${Date.now()}`, ticketNo: `TH-${String(Date.now()).slice(-6)}`, status: 'Pending', createdAt: new Date().toISOString() };
  if (isGoogleSheetsConnected()) {
    const res = await callGoogleAppsScript('createTechnicalTicket', { data: ticket });
    if (!res.ticket) throw new Error('Ticket was not saved. Update the Apps Script deployment and retry.');
    Object.assign(ticket, res.ticket);
  }
  saveLocal(sortNewestFirst([ticket, ...memory.filter(t => t.ticketNo !== ticket.ticketNo)], 'createdAt', 'ticketNo')); return ticket;
}

export async function submitTechnicalTicket(ticketNo, resolvedRemark) {
  if (!resolvedRemark?.trim()) throw new Error('Resolved remark is required.');
  let updated;
  if (isGoogleSheetsConnected()) {
    const res = await callGoogleAppsScript('submitTechnicalTicket', { ticketNo, resolvedRemark: resolvedRemark.trim() });
    if (!res.ticket?.actualDate) throw new Error('Timestamp was not saved. Update the Apps Script deployment and retry.');
    updated = { ...res.ticket, status: 'Resolved' };
  } else {
    const ticket = readLocal().find(t => t.ticketNo === ticketNo);
    if (!ticket) throw new Error('Technical ticket not found.');
    updated = { ...ticket, status: 'Resolved', actualDate: ticket.actualDate || new Date().toISOString(), resolvedRemark: ticket.actualDate ? ticket.resolvedRemark : resolvedRemark.trim() };
  }
  saveLocal(memory.map(t => t.ticketNo === ticketNo ? { ...t, ...updated } : t));
  return updated;
}

export const technicalHelpService = { listTechnicalTickets, createTechnicalTicket, submitTechnicalTicket };
