import { clearTechnicalCache } from '../services/technicalHelpService';
import { clearRepairCache } from '../services/repairService';
import { dataService } from '../services/dataService';

const OWNER_KEY = 'make_system_cache_owner';

// Tickets, repair issues and requests are cached in the browser for speed. They belong to whoever was signed in,
// so they are wiped whenever the user changes (login, logout, expired session) before anything is rendered.
export function resetUserCaches() {
  clearTechnicalCache();
  clearRepairCache();
  dataService.clearRequestsCache();
}

export function setCacheOwner(username) {
  try { if (username) localStorage.setItem(OWNER_KEY, username); else localStorage.removeItem(OWNER_KEY); } catch { /* Not critical. */ }
}

// At startup: if the saved session is a different person than the cache owner, drop the cache first.
export function ensureCacheOwner(user) {
  if (!user) return;
  let owner = null;
  try { owner = localStorage.getItem(OWNER_KEY); } catch { /* Treat as unknown owner. */ }
  if (owner !== user.username) { resetUserCaches(); setCacheOwner(user.username); }
}
