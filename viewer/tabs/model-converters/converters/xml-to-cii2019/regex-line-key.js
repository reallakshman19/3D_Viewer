export function tokenizeBranchName(branchName, delimiter = '-') {
  if (!branchName) return [];
  return branchName
    .replace(/^\//, '')
    .split(delimiter)
    .map(t => t.trim())
    .filter(Boolean);
}

export function deriveLineKeyFromBranchName(branchName, config) {
  const tokens = tokenizeBranchName(branchName);
  const positions = config?.lineKeyTokenPositions || [4]; // default 4
  const lineKeyTokens = [];

  for (const pos of positions) {
    if (pos >= 1 && pos <= tokens.length) {
      lineKeyTokens.push(tokens[pos - 1]);
    }
  }

  return lineKeyTokens.join('-') || branchName;
}

export function getFirstBranchNameFromXml(xmlText) {
  const match = xmlText.match(/<Branchname>([^<]+)<\/Branchname>/i);
  return match ? match[1] : '';
}

export function validateRegexPreviewSample(value) {
  return value && value.includes('/') && value.includes('-');
}
