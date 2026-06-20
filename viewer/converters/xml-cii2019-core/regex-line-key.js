function _toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function _regexGroup(text, pattern, groupIndex = 1) {
  const source = _toText(text).trim();
  const patternText = _toText(pattern).trim();
  if (!source || !patternText) return '';
  try {
    const match = new RegExp(patternText, 'i').exec(source);
    const index = Math.max(0, Number(groupIndex || 0));
    return _toText(match?.[index] || '').trim();
  } catch {
    return '';
  }
}

export function tokenizeBranchName(branchName, delimiter = '-') {
  const cleaned = _toText(branchName).trim().replace(/^\/+/, '').replace(/\/B\d+$/i, '');
  const delim = _toText(delimiter) || '-';
  return cleaned.split(delim).map((token) => token.trim()).filter(Boolean);
}

export function tokenAtPosition(branchName, delimiter, oneBasedIndex) {
  const index = Number(oneBasedIndex);
  if (!Number.isFinite(index) || index <= 0) return '';
  return tokenizeBranchName(branchName, delimiter)[Math.round(index) - 1] || '';
}

export function xmlCiiTokenPositionList(value) {
  if (Array.isArray(value)) return value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0);
  const text = _toText(value).trim();
  if (!text) return [];
  if (!/^\s*\d+(?:\s*[,+]\s*\d+)*\s*$/.test(text)) return [];
  return text
    .split(/[,+]/)
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

export function xmlCiiLineKeyFromBranchTokens(branchName, config) {
  const linelist = config.linelist || {};
  const positions = xmlCiiTokenPositionList(linelist.lineKeyTokenPositions);
  const safePositions = positions.length ? positions : [4];
  const delimiter = linelist.tokenDelimiter || '-';
  const joiner = _toText(linelist.lineKeyJoiner);
  const parts = safePositions.map((position) => tokenAtPosition(branchName, delimiter, position)).filter(Boolean);
  return parts.join(joiner);
}

export function deriveLineKeyFromBranchName(branchName, config) {
  const text = _toText(branchName).trim();
  const linelist = config.linelist || {};

  // Regex is an explicit user override and must take precedence over token fallback.
  // Otherwise a configured regex cannot fix shifted branch formats such as:
  // /ASIM-1885-PL-10"-CS-S8810105-01/B2, where token 4 is the size, not the line key.
  const byRegex = _regexGroup(text, linelist.branchNameRegex, linelist.lineNoGroup || 1);
  if (byRegex) return byRegex;

  const byToken = xmlCiiLineKeyFromBranchTokens(text, config);
  if (byToken) return byToken;
  return '';
}
