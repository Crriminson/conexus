import { describe, expect, it } from 'vitest'
import type { DocumentRow } from '@/hooks/useDocuments'
import { describeExtractionProgress } from './describeExtractionProgress'

function doc(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 'doc-1',
    project_id: 'project-1',
    filename: 'test.pdf',
    storage_path: 'project-1/test.pdf',
    extraction_status: 'complete',
    extraction_error: null,
    extraction_total_chunks: null,
    extraction_completed_chunks: 0,
    ...overrides,
  }
}

describe('describeExtractionProgress', () => {
  it('reports no documents yet when the list is empty', () => {
    expect(describeExtractionProgress([])).toEqual({ text: 'No documents yet', tone: 'neutral' })
  })

  it('reports the actively-processing document\'s own chunk count when one exists', () => {
    const summary = describeExtractionProgress([
      doc({ id: 'a', extraction_status: 'complete' }),
      doc({ id: 'b', extraction_status: 'processing', extraction_total_chunks: 4, extraction_completed_chunks: 3 }),
    ])
    expect(summary).toEqual({ text: 'chunk 3 of 4 processed', tone: 'caution' })
  })

  it('ignores a processing row with no chunk total (pre-chunking, non-chunked flow)', () => {
    const summary = describeExtractionProgress([doc({ extraction_status: 'processing', extraction_total_chunks: null })])
    expect(summary.text).not.toContain('chunk')
  })

  it('falls back to a document-count summary when nothing is actively processing', () => {
    const summary = describeExtractionProgress([
      doc({ id: 'a', extraction_status: 'complete' }),
      doc({ id: 'b', extraction_status: 'failed' }),
      doc({ id: 'c', extraction_status: 'pending' }),
    ])
    expect(summary).toEqual({ text: '1 of 3 document(s) processed', tone: 'caution' })
  })

  it('is confirmed-toned when every document is complete', () => {
    const summary = describeExtractionProgress([doc({ id: 'a' }), doc({ id: 'b' })])
    expect(summary).toEqual({ text: '2 of 2 document(s) processed', tone: 'confirmed' })
  })
})
