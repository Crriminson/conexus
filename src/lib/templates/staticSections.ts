import type { Section } from './types'

// Static boilerplate per architecture §2 — fixed text, no facts, no AI.
// Placeholder copy for the prototype, not reviewed legal language.
export const STATIC_SECTIONS: Section[] = [
  {
    id: 'definitions',
    title: 'Definitions',
    kind: 'static',
    status: 'ready',
    body:
      '"Company" or "Issuer" means the entity named in this Draft Red Herring Prospectus. ' +
      '"DRHP" means Draft Red Herring Prospectus. "SEBI" means the Securities and Exchange ' +
      'Board of India. "Equity Shares" means the equity shares of the Company. ' +
      '[Placeholder boilerplate — not reviewed legal text.]',
    missingFieldPaths: [],
  },
  {
    id: 'general-info',
    title: 'General Information',
    kind: 'static',
    status: 'ready',
    body:
      'This section sets out general information about the offer as required under ' +
      'applicable SEBI regulations, including the registrar and share transfer agent, ' +
      'legal advisors, and bankers to the issue. ' +
      '[Placeholder boilerplate — not reviewed legal text.]',
    missingFieldPaths: [],
  },
]
