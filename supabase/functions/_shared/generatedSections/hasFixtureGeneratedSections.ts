import type { GeneratedSections } from './types.ts'

// The "Demo data" banner's trigger condition, in one place: true when ANY
// generated section present has fixture-sourced content. Reads the
// provenance tag on the content itself (see types.ts's GeneratedSectionSource)
// rather than any separately-tracked flag derived from persistence outcome —
// that indirection is what let the banner and the actual content disagree
// (docs/FIXTURE_INVENTORY.md §4.1). This function can't drift from what's
// rendered because it *is* what decides what's rendered.
export function hasFixtureGeneratedSections(sections: GeneratedSections): boolean {
  return Object.values(sections).some((section) => section?.source === 'fixture')
}
