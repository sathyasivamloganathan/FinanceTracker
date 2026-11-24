const net = require('net');

// Azure App Service (and some other proxies) append the client's SOURCE PORT
// to X-Forwarded-For ("203.0.113.5:51234"), so the same visitor would get a
// different "IP" on every connection and sail past per-IP limits. Normalise:
//  • strip :port from IPv4 and from [IPv6]:port
//  • unwrap IPv4-mapped IPv6 (::ffff:1.2.3.4)
//  • collapse IPv6 to its /64 — one household/host owns a whole /64, so
//    counting individual addresses would be trivial to evade.
function normalizeIp(raw) {
  let ip = String(raw || '').trim();
  if (!ip) return 'unknown';
  const v4port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(ip);
  if (v4port) ip = v4port[1];
  const v6br = /^\[([0-9a-f:.]+)\](?::\d+)?$/i.exec(ip);
  if (v6br) ip = v6br[1];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) ip = mapped[1];
  if (net.isIPv6(ip)) {
    const [head, tail = ''] = ip.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    const missing = Math.max(0, 8 - h.length - t.length);
    const full = [...h, ...Array(ip.includes('::') ? missing : 0).fill('0'), ...t];
    return `${full.slice(0, 4).map((x) => (x || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
  }
  return ip;
}

const ipKey = (req) => normalizeIp(req.ip);

module.exports = { normalizeIp, ipKey };
