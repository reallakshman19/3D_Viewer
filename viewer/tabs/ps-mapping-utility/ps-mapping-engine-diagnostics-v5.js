import {
  DEFAULT_OPTIONS as BASE_OPTIONS,
  DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  normalizePsMappingOptions as baseNormalize,
  runPsMappingResolver as baseRun,
  rowsToCsv,
} from './ps-mapping-engine-diagnostics-v4.js?v=20260611-robust-gap-1';

export { DEFAULT_SUPPORT_KEYWORD_RULES_TEXT, rowsToCsv };

export const DEFAULT_OPTIONS = {
  ...BASE_OPTIONS,
  useBuiltInSupportKeywordLogic: true,
  treatAnchorAsLineStop: true,
  supportKeywordRulesText: DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
};

export function normalizePsMappingOptions(options = {}) {
  const normalized = baseNormalize({
    ...options,
    useBuiltInSupportKeywordLogic: true,
    treatAnchorAsLineStop: true,
    supportKeywordRulesText: String(options.supportKeywordRulesText || '').trim() || DEFAULT_SUPPORT_KEYWORD_RULES_TEXT,
  });
  normalized.useBuiltInSupportKeywordLogic = true;
  normalized.treatAnchorAsLineStop = true;
  normalized.supportKeywordRulesText = String(normalized.supportKeywordRulesText || '').trim() || DEFAULT_SUPPORT_KEYWORD_RULES_TEXT;
  return normalized;
}

export function runPsMappingResolver(input = {}) {
  const options = normalizePsMappingOptions(input.options || {});
  const result = baseRun({ ...input, options });
  return {
    ...result,
    approxConfig: {
      ...(result?.approxConfig || {}),
      supportKeywordSource: 'Support Keyword Rules: Pattern -> Canonical',
      supportKeywordRulesText: options.supportKeywordRulesText,
    },
  };
}
