// SPDX-License-Identifier: EPL-2.0

import { toolsForToken } from '../tools'

const names = (scopes?: string): string[] =>
  toolsForToken({ extra: scopes === undefined ? {} : { scopes } } as any).map((it) => it.name)

describe('toolsForToken', () => {
  it('offers a read key only reading tools', () => {
    const offered = names('read')
    expect(offered).toContain('list_issues')
    expect(offered).toContain('get_document')
    expect(offered.filter((it) => /^(create|update|delete|comment)/.test(it))).toEqual([])
  })

  it('keeps areas apart', () => {
    const issues = names('read,issues:write')
    expect(issues).toContain('create_issue')
    expect(issues).toContain('create_milestone')
    expect(issues).not.toContain('create_document')
    const docs = names('read,documents:write')
    expect(docs).toContain('update_document')
    expect(docs).not.toContain('update_issue')
  })

  it('needs the area and delete to delete', () => {
    expect(names('read,issues:write')).not.toContain('delete_issue')
    expect(names('read,delete')).not.toContain('delete_issue')
    expect(names('read,issues:write,delete')).toContain('delete_issue')
    expect(names('read,issues:write,delete')).not.toContain('delete_document')
  })

  it('offers an unlimited key everything', () => {
    expect(names()).toContain('delete_document')
  })
})
