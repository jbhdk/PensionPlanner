// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Motoren er et rent TypeScript-modul. At den ikke rører React eller DOM er
    ikke en aftale, man kan glemme — det er denne vagt, der håndhæver den.
    Vagten læser sin egen mappe, så en ny fil er dækket uden at nogen husker
    at føje den til noget. */

const engineRoot = fileURLToPath(new URL('.', import.meta.url))
const guard = 'enginePurity.test.ts'

const forbidden: { pattern: RegExp; what: string }[] = [
  { pattern: /from\s+['"]react/, what: 'en import fra React' },
  { pattern: /require\(\s*['"]react/, what: 'en require af React' },
  { pattern: /\bdocument\s*\./, what: 'DOM-globalen document' },
  { pattern: /\bwindow\s*\./, what: 'DOM-globalen window' },
  { pattern: /\blocalStorage\b/, what: 'localStorage' },
  { pattern: /\bfetch\s*\(/, what: 'et netværkskald' },
]

function sources(directory: string): { path: string; text: string }[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sources(path)
    if (!entry.name.endsWith('.ts') || entry.name === guard) return []
    return [{ path, text: readFileSync(path, 'utf8') }]
  })
}

describe('motoren', () => {
  it('har filer at holde øje med', () => {
    expect(sources(engineRoot).length).toBeGreaterThan(0)
  })

  it('importerer intet fra React og rører ingen DOM', () => {
    for (const source of sources(engineRoot)) {
      for (const { pattern, what } of forbidden) {
        expect(
          pattern.test(source.text),
          `${source.path} indeholder ${what} — motoren skal kunne køre uden browser`,
        ).toBe(false)
      }
    }
  })
})
