// Every test run gets its own temp folder, gone when the run ends. The tests make a folder per test
// (mkdtemp) and leave it, so one run of the whole suite left ~1,900 of them in the system's temp, and a
// few runs filled a disk. Pointing TMPDIR/TEMP/TMP here before the workers start sends all of them into
// one folder this removes at the end.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export default function setup(): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'tucano-test-run-'))
  for (const k of ['TMPDIR', 'TEMP', 'TMP']) process.env[k] = dir
  return () => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
    } catch {
      // A file a test left open (Windows): the folder stays, one per run instead of thousands.
    }
  }
}
