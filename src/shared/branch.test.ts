import { describe, it, expect } from 'vitest'
import { isValidBranchName, sanitizeBranchForPath } from './branch'

describe('isValidBranchName', () => {
  it.each([
    'feature/foo',
    'fix/panier+matfer',
    'my.branch',
    'release-1.0',
    'user@feature',
    'v1.0-rc{1}',
    'simple',
  ])('accepts valid branch name: %s', (name) => {
    expect(isValidBranchName(name)).toBe(true)
  })

  it.each([
    ['empty string', ''],
    ['spaces', 'branch name'],
    ['tilde', 'name~1'],
    ['caret', 'name^2'],
    ['colon', 'name:foo'],
    ['backslash', 'name\\foo'],
  ])('rejects invalid branch name: %s', (_label, name) => {
    expect(isValidBranchName(name)).toBe(false)
  })
})

describe('sanitizeBranchForPath', () => {
  it('preserves + and replaces /', () => {
    expect(sanitizeBranchForPath('fixes/panier+matfer')).toBe('fixes-panier+matfer')
  })

  it('returns simple names unchanged', () => {
    expect(sanitizeBranchForPath('simple-branch')).toBe('simple-branch')
  })

  it('replaces spaces', () => {
    expect(sanitizeBranchForPath('feat/some branch')).toBe('feat-some-branch')
  })
})
