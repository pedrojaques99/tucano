import { describe, expect, it } from 'vitest'
import { folderOf } from '../src/renderer/src/components/Skills'

describe('the skills tree', () => {
  it('puts each skill in the folder its SKILL.md lives in', () => {
    expect(folderOf(undefined)).toEqual({ id: 'here', label: 'Criadas aqui' })
    expect(folderOf('/Users/a/.claude/skills/visant-design/SKILL.md').id).toBe('mine')
    expect(folderOf('/Users/a/.codex/skills/x/SKILL.md').id).toBe('codex')
    expect(folderOf('C:\\Users\\a\\.claude\\plugins\\cache\\official\\vercel\\1.2.0\\skills\\ai-sdk\\SKILL.md')).toEqual({ id: 'plugin:vercel', label: 'vercel' })
    expect(folderOf('/Users/a/.claude/plugins/marketplaces/official/plugins/figma/skills/figma-use/SKILL.md').label).toBe('figma')
    expect(folderOf('/Users/a/.claude/plugins/cache/m/plugin-dev/0a1b2c3d4e/skills/agent-development/SKILL.md').label).toBe('plugin-dev')
  })
})
