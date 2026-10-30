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
  import { type Timestamp, type WorkspaceUuid } from '@hcengineering/core'
  import presentation, { copyTextToClipboard } from '@hcengineering/presentation'
  import { type IntlString } from '@hcengineering/platform'
  import view from '@hcengineering/view'
  import {
    CheckBox,
    DropdownLabelsIntl,
    type DropdownIntlItem,
    Label,
    ListItem,
    Modal,
    ModernEditbox,
    Dropdown,
    ticker
  } from '@hcengineering/ui'
  import setting from '@hcengineering/setting'
  import { Analytics } from '@hcengineering/analytics'
  import { createEventDispatcher, onMount } from 'svelte'
  import { getAccountClient } from '../utils'

  let name = ''
  let loading = false
  let error: IntlString | undefined
  let wsItems: ListItem[] = []
  let selectedWs: ListItem | undefined
  let createdToken: string | undefined
  let copiedTime: Timestamp | undefined
  let copied = false

  const expiryItems: DropdownIntlItem[] = [
    { id: '7', label: setting.string.ApiTokenExpiry7Days },
    { id: '30', label: setting.string.ApiTokenExpiry30Days },
    { id: '90', label: setting.string.ApiTokenExpiry90Days },
    { id: '180', label: setting.string.ApiTokenExpiry180Days },
    { id: '365', label: setting.string.ApiTokenExpiry365Days }
  ]
  let selectedExpiry: string = '30'

  const scopeItems: Array<{ id: string, label: IntlString }> = [
    { id: 'read', label: setting.string.ApiTokenScopeRead },
    { id: 'issues:write', label: setting.string.ApiTokenScopeIssues },
    { id: 'documents:write', label: setting.string.ApiTokenScopeDocuments },
    { id: 'files:write', label: setting.string.ApiTokenScopeFiles },
    { id: 'other:write', label: setting.string.ApiTokenScopeOther },
    { id: 'delete', label: setting.string.ApiTokenScopeDelete },
    { id: 'admin', label: setting.string.ApiTokenScopeAdmin }
  ]
  type Preset = 'read' | 'work' | 'custom' | 'full'
  // The server requires read on every limited token, so it stays ticked.
  const presetScopes: Record<'read' | 'work', string[]> = {
    read: ['read'],
    work: ['read', 'issues:write', 'documents:write']
  }
  const presets: Array<{ id: Preset, label: IntlString, hint: IntlString }> = [
    { id: 'read', label: setting.string.ApiTokenPresetRead, hint: setting.string.ApiTokenPresetReadHint },
    { id: 'work', label: setting.string.ApiTokenPresetWork, hint: setting.string.ApiTokenPresetWorkHint },
    { id: 'custom', label: setting.string.ApiTokenPresetCustom, hint: setting.string.ApiTokenPresetCustomHint },
    { id: 'full', label: setting.string.ApiTokenFullAccess, hint: setting.string.ApiTokenPresetFullHint }
  ]
  let preset: Preset = 'work'
  let selectedScopes: string[] = presetScopes.work

  function selectPreset(id: Preset): void {
    preset = id
    if (id === 'read' || id === 'work') selectedScopes = presetScopes[id]
  }

  function toggleScope(id: string, checked: boolean): void {
    preset = 'custom'
    selectedScopes = checked ? [...selectedScopes, id] : selectedScopes.filter((it) => it !== id)
  }

  const dispatch = createEventDispatcher()

  $: canSave = !loading && name.trim().length > 0 && selectedWs !== undefined && createdToken === undefined

  $: if (copiedTime !== undefined && copied && $ticker - copiedTime > 1500) {
    copied = false
  }

  async function loadWorkspaces(): Promise<void> {
    try {
      const workspaces = await getAccountClient().getUserWorkspaces()
      wsItems = workspaces.map((w) => ({ _id: w.uuid, label: w.name ?? w.url }))
      if (wsItems.length > 0) {
        selectedWs = wsItems[0]
      }
    } catch (err: any) {
      Analytics.handleError(err)
      error = setting.string.ApiTokenLoadError
    }
  }

  async function create(): Promise<void> {
    if (selectedWs === undefined) return
    loading = true
    error = undefined
    try {
      const result = await getAccountClient().createApiToken(
        name.trim(),
        selectedWs._id as WorkspaceUuid,
        parseInt(selectedExpiry, 10),
        preset === 'full' ? undefined : selectedScopes
      )
      createdToken = result.token
    } catch (err: any) {
      Analytics.handleError(err)
      error = setting.string.ApiTokenCreateError
    } finally {
      loading = false
    }
  }

  async function copyToken(): Promise<void> {
    if (createdToken === undefined) return
    if (!window.isSecureContext) {
      // No clipboard API outside a secure context. The token stays selectable above.
      dispatch('close', true)
      return
    }
    await copyTextToClipboard(createdToken)
    copied = true
    copiedTime = Date.now()
  }

  onMount(() => {
    void loadWorkspaces()
  })
</script>

<Modal
  type="type-popup"
  label={createdToken !== undefined ? setting.string.ApiTokenCreated : setting.string.CreateApiToken}
  {canSave}
  okLabel={createdToken !== undefined
    ? copied
      ? view.string.Copied
      : view.string.CopyToClipboard
    : presentation.string.Create}
  okAction={createdToken !== undefined ? copyToken : create}
  onCancel={() => {
    dispatch('close', createdToken !== undefined)
  }}
>
  {#if createdToken !== undefined}
    <div class="antiPopup-msg token-reveal">
      <span class="label"><Label label={setting.string.ApiTokenCopyWarning} /></span>
      <div
        class="token-value"
        role="button"
        tabindex="0"
        on:click={copyToken}
        on:keydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') copyToken()
        }}
      >
        {createdToken}
      </div>
    </div>
  {:else}
    <div class="form">
      <div class="field">
        <span class="label"><Label label={setting.string.ApiTokenName} /></span>
        <ModernEditbox label={setting.string.ApiTokenNamePlaceholder} bind:value={name} size="medium" autoFocus />
      </div>
      <div class="columns">
        <div class="field">
          <span class="label"><Label label={setting.string.ApiTokenWorkspace} /></span>
          <Dropdown
            placeholder={setting.string.ApiTokenWorkspace}
            items={wsItems}
            bind:selected={selectedWs}
            kind="regular"
            justify="left"
            width="100%"
            size="large"
          />
        </div>
        <div class="field">
          <span class="label"><Label label={setting.string.ApiTokenExpiry} /></span>
          <DropdownLabelsIntl
            kind="regular"
            size="large"
            width="100%"
            justify="left"
            items={expiryItems}
            selected={selectedExpiry}
            on:selected={(e) => {
              selectedExpiry = e.detail
            }}
          />
        </div>
      </div>
      <div class="field">
        <span class="label" id="token-access"><Label label={setting.string.ApiTokenAccess} /></span>
        <div class="presets" role="radiogroup" aria-labelledby="token-access">
          {#each presets as item (item.id)}
            <button
              type="button"
              class="preset"
              class:selected={preset === item.id}
              role="radio"
              aria-checked={preset === item.id}
              on:click={() => {
                selectPreset(item.id)
              }}
            >
              <span class="preset-label"><Label label={item.label} /></span>
              <span class="preset-hint"><Label label={item.hint} /></span>
            </button>
          {/each}
        </div>
        {#if preset !== 'full'}
          <div class="scopes">
            {#each scopeItems as item (item.id)}
              <div class="scope">
                <CheckBox
                  checked={selectedScopes.includes(item.id)}
                  readonly={item.id === 'read'}
                  on:value={(e) => {
                    toggleScope(item.id, e.detail)
                  }}
                />
                <Label label={item.label} />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    {#if error !== undefined}
      <div class="antiPopup-msg error"><Label label={error} /></div>
    {/if}
  {/if}
</Modal>

<style lang="scss">
  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .presets {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .preset {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    padding: 0.625rem;
    text-align: left;
    background: none;
    border: 1px solid var(--theme-divider-color);
    border-radius: var(--small-BorderRadius);
    cursor: pointer;

    &:hover {
      background-color: var(--theme-navpanel-hovered);
    }
    &.selected {
      border-color: var(--primary-button-default);
      box-shadow: inset 0 0 0 1px var(--primary-button-default);
    }
    &:focus-visible {
      outline: 2px solid var(--primary-button-outline);
    }
  }
  .preset-label {
    font-weight: 500;
    color: var(--theme-caption-color);
  }
  .preset-hint {
    font-size: 0.75rem;
    color: var(--theme-dark-color);
  }
  .scopes {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .scope {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .token-reveal {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .token-value {
    background: var(--theme-popup-color);
    border: 1px solid var(--theme-popup-divider);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    font-family: var(--mono-font);
    font-size: 0.6875rem;
    line-height: 1.6;
    word-break: break-all;
    cursor: pointer;
    user-select: all;
    color: var(--theme-content-color);
  }
  .label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--theme-dark-color);
  }
  .error {
    color: var(--theme-error-color);
    font-size: 0.75rem;
  }
</style>
