<!--
// Copyright © 2025 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
-->
<script lang="ts">
  import {
    Breadcrumb,
    ButtonIcon,
    eventToHTMLElement,
    Header,
    IconAdd,
    IconMoreH,
    Label,
    Loading,
    Menu,
    ModernButton,
    Scroller,
    showPopup
  } from '@hcengineering/ui'
  import { type IntlString } from '@hcengineering/platform'
  import { MessageBox } from '@hcengineering/presentation'
  import setting from '@hcengineering/setting'
  import { Analytics } from '@hcengineering/analytics'
  import { type ApiTokenInfo } from '@hcengineering/account-client'
  import { getAccountClient } from '../utils'
  import { onMount } from 'svelte'
  import { themeStore } from '@hcengineering/theme'
  import ApiTokenCreatePopup from './ApiTokenCreatePopup.svelte'
  import ApiDocsSection from './ApiDocsSection.svelte'

  let loading = true
  let loadError = false
  let revokeError = false
  let tokens: ApiTokenInfo[] = []

  const statusLabelMap = {
    active: setting.string.ApiTokenStatusActive,
    expiring: setting.string.ApiTokenStatusExpiring,
    revoked: setting.string.ApiTokenStatusRevoked,
    expired: setting.string.ApiTokenStatusExpired
  } as const

  const scopeLabels: Record<string, IntlString> = {
    read: setting.string.ApiTokenPillRead,
    'issues:write': setting.string.ApiTokenPillIssues,
    'documents:write': setting.string.ApiTokenPillDocuments,
    'files:write': setting.string.ApiTokenPillFiles,
    'other:write': setting.string.ApiTokenPillOther,
    delete: setting.string.ApiTokenPillDelete,
    admin: setting.string.ApiTokenPillAdmin
  }

  function openMenu(e: MouseEvent, token: ApiTokenInfo): void {
    const actions = [
      {
        label: setting.string.ApiTokenRevoke,
        action: async () => {
          revoke(token)
        }
      }
    ]
    showPopup(Menu, { actions }, eventToHTMLElement(e))
  }

  function loadTokens(): void {
    loading = true
    loadError = false
    getAccountClient()
      .listApiTokens()
      .then((res) => {
        // Tokens that still work come first, newest at the top.
        tokens = res.sort((a, b) => Number(isUsable(b)) - Number(isUsable(a)) || b.createdOn - a.createdOn)
        loading = false
      })
      .catch((err) => {
        Analytics.handleError(err)
        tokens = []
        loading = false
        loadError = true
      })
  }

  function create(): void {
    showPopup(ApiTokenCreatePopup, {}, 'top', (res) => {
      if (res === true) {
        loadTokens()
      }
    })
  }

  function revoke(token: ApiTokenInfo): void {
    showPopup(MessageBox, {
      label: setting.string.ApiTokenRevoke,
      message: setting.string.ApiTokenRevokeConfirm,
      dangerous: true,
      action: async () => {
        try {
          await getAccountClient().revokeApiToken(token.id)
          revokeError = false
        } catch (err: any) {
          Analytics.handleError(err)
          revokeError = true
        }
        loadTokens()
      }
    })
  }

  function isUsable(token: ApiTokenInfo): boolean {
    return !token.revoked && token.expiresOn >= Date.now()
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString($themeStore.language ?? 'en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function getStatus(token: ApiTokenInfo): 'active' | 'expiring' | 'revoked' | 'expired' {
    if (token.revoked) return 'revoked'
    const now = Date.now()
    if (token.expiresOn < now) return 'expired'
    if (token.expiresOn - now < 7 * 86400000) return 'expiring'
    return 'active'
  }

  onMount(() => {
    loadTokens()
  })
</script>

<div class="hulyComponent">
  <Header adaptive={'disabled'}>
    <Breadcrumb icon={setting.icon.ApiToken} label={setting.string.ApiTokens} size="large" isCurrent />
    <svelte:fragment slot="actions">
      <ModernButton
        kind="primary"
        icon={IconAdd}
        label={setting.string.CreateApiToken}
        disabled={loading}
        size="small"
        on:click={create}
      />
    </svelte:fragment>
  </Header>
  <div class="hulyComponent-content__container columns">
    <div class="hulyComponent-content__column p-6">
      {#if loading}
        <Loading />
      {:else if loadError}
        <div class="hulyComponent-content__empty">
          <Label label={setting.string.ApiTokenLoadError} />
          <div class="mt-2">
            <ModernButton label={setting.string.Reconnect} size="small" on:click={loadTokens} />
          </div>
        </div>
      {:else if revokeError}
        <div class="hulyComponent-content__empty">
          <Label label={setting.string.ApiTokenRevokeError} />
          <div class="mt-2">
            <ModernButton label={setting.string.Reconnect} size="small" on:click={loadTokens} />
          </div>
        </div>
      {:else if tokens.length === 0}
        <div class="hulyComponent-content__empty">
          <Label label={setting.string.ApiTokenNoTokens} />
        </div>
      {:else}
        <Scroller>
          <table class="tokens">
            <colgroup>
              <col class="col-name" />
              <col />
              <col class="col-expires" />
              <col class="col-status" />
              <col class="col-menu" />
            </colgroup>
            <thead>
              <tr>
                <th><Label label={setting.string.ApiTokenName} /></th>
                <th><Label label={setting.string.ApiTokenAccess} /></th>
                <th><Label label={setting.string.Expires} /></th>
                <th><Label label={setting.string.TokenStatus} /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each tokens as token (token.id)}
                {@const status = getStatus(token)}
                <tr class:inactive={status === 'revoked' || status === 'expired'}>
                  <td>
                    <div class="name">{token.name}</div>
                    <div class="meta">
                      {token.workspaceName} · <Label label={setting.string.Created} />
                      {formatDate(token.createdOn)}
                    </div>
                  </td>
                  <td>
                    <div class="pills">
                      {#if token.scopes === undefined}
                        <span class="pill full"><Label label={setting.string.ApiTokenFullAccess} /></span>
                      {:else if token.scopes.length === 1 && token.scopes[0] === 'read'}
                        <span class="pill"><Label label={setting.string.ApiTokenPresetRead} /></span>
                      {:else}
                        {#each token.scopes as scope (scope)}
                          <span class="pill">
                            {#if scopeLabels[scope] !== undefined}<Label label={scopeLabels[scope]} />{:else}{scope}{/if}
                          </span>
                        {/each}
                      {/if}
                    </div>
                  </td>
                  <td>{token.revoked ? '—' : formatDate(token.expiresOn)}</td>
                  <td>
                    <span class="pill" class:ok={status === 'active'} class:warn={status === 'expiring'}>
                      <Label label={statusLabelMap[status]} />
                    </span>
                  </td>
                  <td>
                    {#if !token.revoked}
                      <ButtonIcon
                        kind="tertiary"
                        size="small"
                        icon={IconMoreH}
                        tooltip={{ label: setting.string.ApiTokenRevoke }}
                        on:click={(e) => {
                          openMenu(e, token)
                        }}
                      />
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </Scroller>
      {/if}

      <ApiDocsSection />
    </div>
  </div>
</div>

<style lang="scss">
  .tokens {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }
  .col-name {
    width: 30%;
  }
  .col-expires {
    width: 8rem;
  }
  .col-status {
    width: 7rem;
  }
  .col-menu {
    width: 3rem;
  }
  th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 500;
    font-size: 0.75rem;
    color: var(--theme-dark-color);
    border-bottom: 1px solid var(--theme-divider-color);
  }
  td {
    padding: 0.75rem;
    vertical-align: middle;
    color: var(--theme-content-color);
    border-bottom: 1px solid var(--theme-divider-color);
  }
  .name {
    overflow: hidden;
    font-weight: 500;
    color: var(--theme-caption-color);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .meta {
    margin-top: 0.125rem;
    font-size: 0.75rem;
    color: var(--theme-halfcontent-color);
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .pill {
    display: inline-flex;
    padding: 0.125rem 0.5rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    white-space: nowrap;
    background-color: var(--theme-button-default);
    border: 1px solid var(--theme-divider-color);
    color: var(--theme-content-color);
  }
  .full {
    background-color: var(--secondary-button-default);
    color: var(--primary-button-default);
  }
  .ok {
    background-color: var(--theme-state-positive-background-color);
    color: var(--theme-state-positive-color);
  }
  .warn {
    background-color: var(--theme-button-warning-bg);
    color: var(--theme-caption-color);
  }
  .inactive td,
  .inactive .name {
    color: var(--theme-halfcontent-color);
  }
  .inactive .name {
    font-weight: 400;
  }
</style>
