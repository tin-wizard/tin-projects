// SPDX-License-Identifier: EPL-2.0

import {
  isAccountMethodAllowedForToken,
  isCollaboratorMethodAllowedForToken,
  isRestRouteAllowedForToken,
  isTxAllowedForToken,
  tokenHasScope
} from '../scopes'

const limited = (...scopes: string[]): { extra: Record<string, any> } => ({ extra: { apiTokenId: 'x', scopes: scopes.join(',') } })
const full = { extra: { apiTokenId: 'x' } }

const create = (objectClass: string, more: Record<string, any> = {}): Record<string, any> => ({
  _class: 'core:class:TxCreateDoc',
  objectClass,
  objectSpace: 'some-space',
  ...more
})

describe('tokenHasScope', () => {
  it('lets tokens without scopes do anything', () => {
    expect(tokenHasScope(full, 'admin')).toBe(true)
    expect(tokenHasScope({}, 'delete')).toBe(true)
  })
  it('limits tokens with scopes, and refuses malformed scopes', () => {
    expect(tokenHasScope(limited('read'), 'read')).toBe(true)
    expect(tokenHasScope(limited('read'), 'issues:write')).toBe(false)
    expect(tokenHasScope({ extra: { scopes: ['admin'] } }, 'admin')).toBe(false)
    expect(tokenHasScope({ extra: { scopes: 'administrator' } }, 'admin')).toBe(false)
  })
})

describe('isTxAllowedForToken', () => {
  it('maps changes to the scope of their area', () => {
    const issue = create('tracker:class:Issue')
    expect(isTxAllowedForToken(limited('issues:write'), issue)).toBe(true)
    expect(isTxAllowedForToken(limited('read'), issue)).toBe(false)
    expect(isTxAllowedForToken(limited('documents:write'), issue)).toBe(false)
    expect(isTxAllowedForToken(limited('documents:write'), create('document:class:Document'))).toBe(true)
    expect(isTxAllowedForToken(limited('files:write'), create('attachment:class:Attachment'))).toBe(true)
    expect(isTxAllowedForToken(limited('other:write'), create('time:class:ToDo'))).toBe(true)
    expect(isTxAllowedForToken(limited('issues:write'), create('time:class:ToDo'))).toBe(false)
  })

  it('treats comments as part of what they are attached to', () => {
    const comment = create('chunter:class:ChatMessage', { attachedToClass: 'tracker:class:Issue' })
    expect(isTxAllowedForToken(limited('issues:write'), comment)).toBe(true)
    expect(isTxAllowedForToken(limited('other:write'), comment)).toBe(false)
    const chat = create('chunter:class:ChatMessage', { attachedToClass: 'chunter:class:Channel' })
    expect(isTxAllowedForToken(limited('other:write'), chat)).toBe(true)
    expect(isTxAllowedForToken(limited('issues:write'), chat)).toBe(false)
  })

  it('needs admin for people, settings, core classes and the model space', () => {
    for (const tx of [
      create('contact:mixin:Employee'),
      create('setting:class:InviteSettings'),
      create('core:class:Space'),
      create('tracker:class:Issue', { objectSpace: 'core:space:Model' })
    ]) {
      expect(isTxAllowedForToken(limited('issues:write', 'other:write'), tx)).toBe(false)
      expect(isTxAllowedForToken(limited('admin'), tx)).toBe(true)
    }
  })

  it('needs both the area and delete to remove something', () => {
    const remove = create('tracker:class:Issue', { _class: 'core:class:TxRemoveDoc' })
    expect(isTxAllowedForToken(limited('issues:write'), remove)).toBe(false)
    expect(isTxAllowedForToken(limited('delete'), remove)).toBe(false)
    expect(isTxAllowedForToken(limited('issues:write', 'delete'), remove)).toBe(true)
  })

  it('checks every transaction nested in an apply', () => {
    const apply = (...txes: unknown[]): Record<string, any> => ({ _class: 'core:class:TxApplyIf', txes })
    expect(isTxAllowedForToken(limited('issues:write'), apply(create('tracker:class:Issue')))).toBe(true)
    expect(
      isTxAllowedForToken(limited('issues:write'), apply(create('tracker:class:Issue'), create('core:class:Space')))
    ).toBe(false)
    expect(isTxAllowedForToken(limited('admin'), apply(apply(create('tracker:class:Issue'))))).toBe(false)
  })

  it('refuses anything it does not recognize', () => {
    const all = limited('read', 'issues:write', 'documents:write', 'files:write', 'other:write', 'delete', 'admin')
    expect(isTxAllowedForToken(all, { _class: 'core:class:TxDomainEvent', domain: 'x' })).toBe(false)
    expect(isTxAllowedForToken(all, { _class: 'core:class:TxCreateDoc' })).toBe(false)
    expect(isTxAllowedForToken(all, null)).toBe(false)
    expect(isTxAllowedForToken(all, 'text')).toBe(false)
  })

  it('does not limit tokens without scopes', () => {
    expect(isTxAllowedForToken(full, create('core:class:Space'))).toBe(true)
  })
})

describe('isRestRouteAllowedForToken', () => {
  it('allows listed routes only', () => {
    expect(isRestRouteAllowedForToken(limited('read'), 'findAll')).toBe(true)
    expect(isRestRouteAllowedForToken(limited('issues:write'), 'findAll')).toBe(false)
    expect(isRestRouteAllowedForToken(limited('issues:write'), 'tx')).toBe(true)
    for (const route of ['v1-create', 'v1-update', 'domainRequest', 'ensurePerson', 'unknown']) {
      expect(isRestRouteAllowedForToken(limited('read', 'admin'), route)).toBe(false)
      expect(isRestRouteAllowedForToken(full, route)).toBe(true)
    }
  })
})

describe('isAccountMethodAllowedForToken', () => {
  it('never allows methods that can issue another token', () => {
    const all = limited('read', 'issues:write', 'documents:write', 'files:write', 'other:write', 'delete', 'admin')
    for (const method of ['selectWorkspace', 'createApiToken', 'login', 'joinByToken', 'createWorkspace', 'toString']) {
      expect(isAccountMethodAllowedForToken(all, method)).toBe(false)
    }
  })
  it('needs admin for invites and roles', () => {
    expect(isAccountMethodAllowedForToken(limited('read'), 'sendInvite')).toBe(false)
    expect(isAccountMethodAllowedForToken(limited('admin'), 'sendInvite')).toBe(true)
    expect(isAccountMethodAllowedForToken(limited('read'), 'updateWorkspaceRole')).toBe(false)
  })
  it('allows what services need to validate the token', () => {
    expect(isAccountMethodAllowedForToken(limited('issues:write'), 'getLoginInfoByToken')).toBe(true)
    expect(isAccountMethodAllowedForToken(limited('issues:write'), 'getWorkspaceInfo')).toBe(true)
  })
})

describe('isCollaboratorMethodAllowedForToken', () => {
  const doc = 'document:class:Document'
  const issue = 'tracker:class:Issue'
  it('needs the write scope of the content it changes', () => {
    expect(isCollaboratorMethodAllowedForToken(limited('read'), 'getContent', doc)).toBe(true)
    expect(isCollaboratorMethodAllowedForToken(limited('issues:write'), 'getContent', doc)).toBe(false)
    expect(isCollaboratorMethodAllowedForToken(limited('read'), 'updateContent', doc)).toBe(false)
    expect(isCollaboratorMethodAllowedForToken(limited('read'), 'createContent', doc)).toBe(false)
    expect(isCollaboratorMethodAllowedForToken(limited('documents:write'), 'updateContent', doc)).toBe(true)
    expect(isCollaboratorMethodAllowedForToken(limited('documents:write'), 'createContent', issue)).toBe(false)
    expect(isCollaboratorMethodAllowedForToken(limited('issues:write'), 'createContent', issue)).toBe(true)
  })
})

describe('identity and public links', () => {
  const update = (operations: unknown): Record<string, any> =>
    create('chunter:class:ChatMessage', { _class: 'core:class:TxUpdateDoc', attachedToClass: 'tracker:class:Issue', operations })
  it('refuses moving or relabelling a document', () => {
    const issues = limited('issues:write')
    expect(isTxAllowedForToken(issues, update({ message: 'x' }))).toBe(true)
    for (const operations of [{ attachedTo: 'x' }, { attachedToClass: 'x' }, { space: 'x' }, { _class: 'x' }, { collection: 'x' }, { $set: { space: 'x' } }]) {
      expect(isTxAllowedForToken(issues, update(operations))).toBe(false)
    }
  })
  it('refuses a comment that does not name its target at the top level', () => {
    expect(isTxAllowedForToken(limited('other:write'), create('chunter:class:ChatMessage'))).toBe(false)
    expect(
      isTxAllowedForToken(limited('other:write'), create('chunter:class:ChatMessage', { attachedToClass: 'chunter:class:Channel', attributes: { attachedToClass: 'tracker:class:Issue' } }))
    ).toBe(false)
  })
  it('needs admin for any class not named', () => {
    for (const objectClass of ['request:class:Request', 'process:class:Process', 'someplugin:class:New']) {
      expect(isTxAllowedForToken(limited('other:write', 'issues:write', 'documents:write'), create(objectClass))).toBe(false)
      expect(isTxAllowedForToken(limited('admin'), create(objectClass))).toBe(true)
    }
  })

  it('needs admin to create a public link', () => {
    expect(isTxAllowedForToken(limited('other:write'), create('guest:class:PublicLink'))).toBe(false)
    expect(isTxAllowedForToken(limited('admin'), create('guest:class:PublicLink'))).toBe(true)
  })
})

describe('admin classes', () => {
  const isSpace = (objectClass: string): boolean => objectClass.endsWith('Project') || objectClass.endsWith('Channel')
  const update = (objectClass: string, operations: unknown): Record<string, any> =>
    create(objectClass, { _class: 'core:class:TxUpdateDoc', operations })

  it('lets issues:write take an issue number and nothing else on a project', () => {
    const issues = limited('issues:write')
    const allowed = (t: unknown): boolean => isTxAllowedForToken(issues, t, isSpace)
    expect(allowed(update('tracker:class:Project', { $inc: { sequence: 1 } }))).toBe(true)
    for (const operations of [
      { members: ['someone'] },
      { $push: { members: 'someone' } },
      { $inc: { sequence: 1 }, members: ['someone'] },
      { $inc: { sequence: 1, other: 1 } },
      { $inc: { sequence: -5 } },
      null
    ]) {
      expect(allowed(update('tracker:class:Project', operations))).toBe(false)
      expect(isTxAllowedForToken(limited('admin'), update('tracker:class:Project', operations), isSpace)).toBe(true)
    }
    expect(allowed(create('tracker:class:Project'))).toBe(false)
  })

  it('needs admin for any class the server marks, in every area', () => {
    const members = update('chunter:class:Channel', { members: [] })
    expect(isTxAllowedForToken(limited('other:write'), members, isSpace)).toBe(false)
    expect(isTxAllowedForToken(limited('other:write'), update('chunter:class:Channel', { $inc: { sequence: 1 } }), isSpace)).toBe(false)
    expect(isTxAllowedForToken(limited('admin'), members, isSpace)).toBe(true)
    const apply = { _class: 'core:class:TxApplyIf', txes: [members] }
    expect(isTxAllowedForToken(limited('other:write'), apply, isSpace)).toBe(false)
  })
})
