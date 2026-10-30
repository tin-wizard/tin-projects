// SPDX-License-Identifier: EPL-2.0

import type { Token } from './token'

/**
 * Permissions a limited API token can hold, stored in the signed token as `extra.scopes`,
 * comma-separated because token extras are strings.
 * A token without `extra.scopes` is not limited: it can do what its owner can.
 * Scopes only ever narrow access; the owner's workspace role and space permissions still apply.
 * @public
 */
export const apiTokenScopes = [
  'read',
  'issues:write',
  'documents:write',
  'files:write',
  'other:write',
  'delete',
  'admin'
] as const

/**
 * @public
 */
export type ApiTokenScope = (typeof apiTokenScopes)[number]

/**
 * @public
 */
export function isApiTokenScope (value: unknown): value is ApiTokenScope {
  return apiTokenScopes.includes(value as ApiTokenScope)
}

/**
 * @public
 */
export function isLimitedToken (token: Pick<Token, 'extra'>): boolean {
  return token.extra?.scopes !== undefined
}

/**
 * True when the token may use the scope. Tokens that aren't limited always may.
 * @public
 */
export function tokenHasScope (token: Pick<Token, 'extra'>, scope: ApiTokenScope): boolean {
  const scopes = token.extra?.scopes
  if (scopes === undefined) return true
  return typeof scopes === 'string' && scopes.split(',').includes(scope)
}

// Class ids are strings here so this package doesn't depend on every plugin's model.
const issueClasses = ['tracker:', 'task:', 'tags:', 'activity:']
const documentClasses = ['document:']
const fileClasses = ['attachment:', 'drive:']
const otherClasses = ['chunter:', 'time:', 'calendar:', 'notification:']
export const commentClasses = ['chunter:class:ChatMessage', 'chunter:class:ThreadMessage']
const modelSpace = 'core:space:Model'

function startsWithAny (value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix))
}

// Anything not named here needs admin. Other classes can act with more than their area suggests:
// a stored request runs its saved transaction with elevated rights, and a public link signs a token.
function scopeForClass (objectClass: string): ApiTokenScope {
  if (startsWithAny(objectClass, issueClasses)) return 'issues:write'
  if (startsWithAny(objectClass, documentClasses)) return 'documents:write'
  if (startsWithAny(objectClass, fileClasses)) return 'files:write'
  if (startsWithAny(objectClass, otherClasses)) return 'other:write'
  return 'admin'
}

// Creating an issue takes its number by incrementing the project's sequence.
function isIssueNumberIncrement (tx: Record<string, any>): boolean {
  if (tx._class !== 'core:class:TxUpdateDoc' || tx.objectClass !== 'tracker:class:Project') return false
  const operations = tx.operations
  if (operations === null || typeof operations !== 'object') return false
  const inc = operations.$inc
  return (
    Object.keys(operations).length === 1 &&
    inc !== null &&
    typeof inc === 'object' &&
    Object.keys(inc).length === 1 &&
    inc.sequence === 1
  )
}

// What a document is and where it lives is what the scope was judged on, so a limited token can't change it.
const identityFields = ['_class', 'space', 'attachedTo', 'attachedToClass', 'collection']

function changesIdentity (operations: unknown): boolean {
  if (operations === null || typeof operations !== 'object') return false
  return Object.entries(operations).some(([key, value]) =>
    key.startsWith('$') ? changesIdentity(value) : identityFields.includes(key)
  )
}

function scopeForDocumentChange (tx: Record<string, any>, isAdminClass: AdminClassCheck): ApiTokenScope | undefined {
  const objectClass = tx.objectClass
  if (typeof objectClass !== 'string') return undefined
  if (changesIdentity(tx.operations) || changesIdentity(tx.attributes)) return undefined
  // Changing the workspace model (for example custom attributes) affects everyone.
  if (tx.objectSpace === modelSpace) return 'admin'
  if (isAdminClass(objectClass)) return isIssueNumberIncrement(tx) ? 'issues:write' : 'admin'
  // A comment belongs to whatever it's attached to.
  if (commentClasses.includes(objectClass)) {
    if (typeof tx.attachedToClass === 'string') return scopeForClass(tx.attachedToClass)
    // A new comment must say what it's attached to, or the transactor can't check the target.
    if (tx._class === 'core:class:TxCreateDoc') return undefined
  }
  return scopeForClass(objectClass)
}

/**
 * True for classes that hold membership, permissions or the workspace model, such as anything
 * derived from Space. Only the server's hierarchy knows these, so the transactor supplies it.
 * @public
 */
export type AdminClassCheck = (objectClass: string) => boolean

/**
 * Whether a limited token may submit this transaction. Anything not recognized is refused,
 * so a new kind of transaction stays closed until someone decides which scope it needs.
 * Tokens that aren't limited are always allowed; other checks still apply to them.
 * Classes in a request are only claims: the transactor must first replace them with what is
 * stored for the target document, because documents of different classes share a table.
 * @public
 */
export function isTxAllowedForToken (
  token: Pick<Token, 'extra'>,
  tx: unknown,
  isAdminClass: AdminClassCheck = () => false
): boolean {
  if (!isLimitedToken(token)) return true
  if (tx === null || typeof tx !== 'object') return false
  const value = tx as Record<string, any>
  switch (value._class) {
    case 'core:class:TxCreateDoc':
    case 'core:class:TxUpdateDoc':
    case 'core:class:TxMixin': {
      const scope = scopeForDocumentChange(value, isAdminClass)
      return scope !== undefined && tokenHasScope(token, scope)
    }
    case 'core:class:TxRemoveDoc': {
      const scope = scopeForDocumentChange(value, isAdminClass)
      return scope !== undefined && tokenHasScope(token, scope) && tokenHasScope(token, 'delete')
    }
    case 'core:class:TxApplyIf':
      return Array.isArray(value.txes) && value.txes.every((it: unknown) => isTxAllowedForToken(token, it, isAdminClass))
    default:
      return false
  }
}

const limitedRouteScopes: Record<string, ApiTokenScope | 'perTx' | 'none'> = {
  ping: 'none',
  findAll: 'read',
  findAllPage: 'read',
  account: 'read',
  loadModel: 'read',
  searchFulltext: 'read',
  generateId: 'read',
  tx: 'perTx'
}

/**
 * Whether a limited token may call a transactor REST route, named as in `withSession`.
 * Routes not listed are refused. The `tx` route also needs {@link isTxAllowedForToken}.
 * @public
 */
export function isRestRouteAllowedForToken (token: Pick<Token, 'extra'>, method: string): boolean {
  if (!isLimitedToken(token)) return true
  const required = limitedRouteScopes[method]
  if (required === undefined) return false
  return required === 'none' || required === 'perTx' || tokenHasScope(token, required)
}

const limitedAccountMethods: Record<string, ApiTokenScope | 'none'> = {
  getLoginInfoByToken: 'none',
  getLoginWithWorkspaceInfo: 'none',
  getWorkspaceInfo: 'none',
  getWorkspaceMembers: 'read',
  getPerson: 'read',
  findPersonBySocialId: 'read',
  findSocialIdBySocialKey: 'read',
  getSocialIds: 'read',
  getAccountInfo: 'read',
  sendInvite: 'admin',
  resendInvite: 'admin',
  createInvite: 'admin',
  createInviteLink: 'admin',
  updateWorkspaceRole: 'admin',
  ensurePerson: 'admin'
}

/**
 * Whether a limited token may call an account service method. This is an allowlist because
 * other methods (selecting a workspace, for example) issue new tokens without these limits.
 * @public
 */
export function isAccountMethodAllowedForToken (token: Pick<Token, 'extra'>, method: string): boolean {
  if (!isLimitedToken(token)) return true
  if (!Object.prototype.hasOwnProperty.call(limitedAccountMethods, method)) return false
  const required = limitedAccountMethods[method]
  return required === 'none' || tokenHasScope(token, required)
}

/**
 * Whether a limited token may read or edit collaborative content, such as an issue description
 * or a document body. Editing needs the write scope of the class the content belongs to.
 * @public
 */
export function isCollaboratorMethodAllowedForToken (
  token: Pick<Token, 'extra'>,
  method: string,
  objectClass: string
): boolean {
  if (!isLimitedToken(token)) return true
  return tokenHasScope(token, method === 'getContent' ? 'read' : scopeForClass(objectClass))
}
