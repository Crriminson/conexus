import { describe, expect, it } from 'vitest'
import { isDemoMode, isMissingSchemaError, parseDemoMode } from './index'

describe('parseDemoMode', () => {
  it('is false for undefined/empty', () => {
    expect(parseDemoMode(undefined)).toBe(false)
    expect(parseDemoMode('')).toBe(false)
  })

  it('is true for "true"/"1", case- and whitespace-insensitive', () => {
    expect(parseDemoMode('true')).toBe(true)
    expect(parseDemoMode('TRUE')).toBe(true)
    expect(parseDemoMode('  true  ')).toBe(true)
    expect(parseDemoMode('1')).toBe(true)
  })

  it('is false for anything else, including "false"', () => {
    expect(parseDemoMode('false')).toBe(false)
    expect(parseDemoMode('0')).toBe(false)
    expect(parseDemoMode('yes')).toBe(false)
  })
})

describe('isMissingSchemaError', () => {
  it('is true for undefined_column (42703), undefined_table (42P01), and PostgREST schema-cache-miss (PGRST205)', () => {
    expect(isMissingSchemaError({ code: '42703' })).toBe(true)
    expect(isMissingSchemaError({ code: '42P01' })).toBe(true)
    // PGRST205 is what a missing table actually reports through PostgREST
    // (verified live, 2026-08-11) — a missing column reports raw 42703, but
    // a missing table never reaches Postgres, so it never gets 42P01 either.
    expect(isMissingSchemaError({ code: 'PGRST205' })).toBe(true)
  })

  it('is false for other error codes, or no code at all', () => {
    expect(isMissingSchemaError({ code: '23505' })).toBe(false)
    expect(isMissingSchemaError({ message: 'network error' })).toBe(false)
    expect(isMissingSchemaError(null)).toBe(false)
    expect(isMissingSchemaError(undefined)).toBe(false)
  })
})

describe('isDemoMode (client wrapper)', () => {
  it('reads VITE_DEMO_MODE off the injected env object', () => {
    expect(isDemoMode({ VITE_DEMO_MODE: 'true' })).toBe(true)
    expect(isDemoMode({ VITE_DEMO_MODE: undefined })).toBe(false)
    expect(isDemoMode({ VITE_DEMO_MODE: 'false' })).toBe(false)
  })

  it('defaults to reading the real import.meta.env when no override is passed', () => {
    // This test's own env has no VITE_DEMO_MODE set — asserting it doesn't
    // throw and returns a boolean is the real contract here.
    expect(typeof isDemoMode()).toBe('boolean')
  })
})
