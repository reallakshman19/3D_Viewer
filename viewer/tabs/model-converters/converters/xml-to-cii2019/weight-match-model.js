export function buildWeightMatchIssues(previewModel) {
  const issues = [];
  for (const branch of previewModel.branches || []) {
    for (const node of branch.nodes || []) {
      if (node.nodeNumber === -1) continue; // Skip fake nodes

      const hasMultipleCandidates = node.candidates && node.candidates.length > 1;
      const weightDiffers = node.bestCandidate && node.xmlWeight !== node.bestCandidate.weight;
      const isZeroWeight = !node.xmlWeight || node.xmlWeight === 0;

      if (hasMultipleCandidates || weightDiffers || isZeroWeight) {
        issues.push({
          branchName: branch.branchName,
          nodeNumber: node.nodeNumber,
          componentType: node.componentType,
          currentWeight: node.xmlWeight,
          candidates: node.candidates
        });
      }
    }
  }
  return issues;
}
