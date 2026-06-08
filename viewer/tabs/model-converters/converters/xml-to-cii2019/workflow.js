import { deriveLineKeyFromBranchName } from './regex-line-key.js';
import { detectLineListFieldMap } from './linelist-mapping.js';
import { buildXmlCiiPreviewModel } from './preview-model.js';
import { renderPreviewModel } from './preview-renderer.js';
import { buildWeightMatchIssues } from './weight-match-model.js';
import { renderWeightMatch } from './weight-match-renderer.js';
import { renderSupportTypes } from './support-types-renderer.js';

export const WORKFLOW_PHASES = [
  { id: 'regex', label: '1 Regex', summary: 'Derive line key, piping class, and size from XML Branchname tokens or regex.' },
  { id: 'import-masters', label: '2 Import Masters', summary: 'Load line list, piping class, material map, and valve weight sources.' },
  { id: 'preview', label: '3 Preview', summary: 'Dry-run enrichment preview per branch.' },
  { id: 'diagnostics', label: '4 Diagnostics', summary: 'Run Dry Run to inspect enrichment data.' },
  { id: 'weight-match', label: '4A Weight Match', summary: 'Review approximate component weights matched by bore, rating, and length.' },
  { id: 'run', label: '5 Run', summary: 'Run the conversion.' },
  { id: 'support-mapper', label: '6 Support Types', summary: 'Map ATT/RVM fields to CII support kinds.' },
  { id: 'config', label: '7 Config', summary: 'Edit all enrichment configuration fields.' }
];

export class XmlToCiiWorkflow {
  constructor(context) {
    this.context = context;
    this.state = {
      previewModel: null,
      weightIssues: []
    };
  }

  async runPhase(phaseId, container) {
    switch (phaseId) {
      case 'preview':
        this.state.previewModel = buildXmlCiiPreviewModel(this.context);
        renderPreviewModel(container, this.state.previewModel);
        break;
      case 'weight-match':
        if (!this.state.previewModel) {
          this.state.previewModel = buildXmlCiiPreviewModel(this.context);
        }
        this.state.weightIssues = buildWeightMatchIssues(this.state.previewModel);
        renderWeightMatch(container, this.state.weightIssues, {
          onCandidateSelected: (node, val) => console.log('Candidate selected', node, val)
        });
        break;
      case 'support-mapper':
        renderSupportTypes(container, this.context.config, {});
        break;
      default:
        container.innerHTML = `<div>Phase ${phaseId} rendered via modular workflow.</div>`;
    }
  }
}
