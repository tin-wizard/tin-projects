<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
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
  import { getMetadata, setMetadata } from '@hcengineering/platform'
  import presentation from '@hcengineering/presentation'
  import {
    Location,
    Popup,
    Scroller,
    fetchMetadataLocalStorage,
    getCurrentLocation,
    location,
    setMetadataLocalStorage
  } from '@hcengineering/ui'
  import { onDestroy, onMount } from 'svelte'
  import Auth from './Auth.svelte'
  import Confirmation from './Confirmation.svelte'
  import ConfirmationSend from './ConfirmationSend.svelte'
  import CreateWorkspaceForm from './CreateWorkspaceForm.svelte'
  import Join from './Join.svelte'
  import AutoJoin from './AutoJoin.svelte'
  import LoginForm from './LoginForm.svelte'
  import ProvidersOnlyForm from './ProvidersOnlyForm.svelte'
  import PasswordRequest from './PasswordRequest.svelte'
  import PasswordRestore from './PasswordRestore.svelte'
  import SelectWorkspace from './SelectWorkspace.svelte'
  import SignupForm from './SignupForm.svelte'
  import LoginTfaForm from './LoginTfaForm.svelte'
  import BottomActionComponent from './BottomAction.svelte'
  import { loginFooterActions } from '../footerActions'
  import { Pages, getAccount, pages } from '..'
  import login from '../plugin'

  import AdminWorkspaces from './AdminWorkspaces.svelte'
  import ChangePassword from './ChangePassword.svelte'
  import BrandPanel from './BrandPanel.svelte'

  export let page: Pages = 'signup'

  const signUpDisabled = getMetadata(login.metadata.DisableSignUp) ?? false
  const localLoginHidden = getMetadata(login.metadata.HideLocalLogin) ?? false
  const useOTP = getMetadata(presentation.metadata.MailUrl) != null && getMetadata(presentation.metadata.MailUrl) !== ''
  let navigateUrl: string | undefined
  let tfaToken: string | undefined = undefined

  onDestroy(location.subscribe(updatePageLoc))

  function updatePageLoc(loc: Location): void {
    const token = getMetadata(presentation.metadata.Token)
    page = (loc.path[1] as Pages) ?? (token != null ? 'selectWorkspace' : 'login')
    if (page === 'join' && loc.query?.autoJoin !== undefined) {
      page = 'autoJoin'
    }

    const allowedUnauthPages: Pages[] = [
      'login',
      'signup',
      'password',
      'recovery',
      'join',
      'autoJoin',
      'confirm',
      'confirmationSend',
      'auth',
      'tfa'
    ]
    if (token === undefined ? !allowedUnauthPages.includes(page) : !pages.includes(page)) {
      const account = fetchMetadataLocalStorage(login.metadata.LastAccount)
      page = account != null ? 'login' : 'signup'
    }

    navigateUrl = loc.query?.navigateUrl ?? undefined
    tfaToken = loc.query?.token ?? undefined
  }

  async function chooseToken(): Promise<void> {
    if (page === 'auth') {
      // token handled by auth page
      return
    } else if (page === 'autoJoin') {
      // there's a separate workflow for auto join
      return
    }

    if (getMetadata(presentation.metadata.Token) == null) {
      const lastAccount = fetchMetadataLocalStorage(login.metadata.LastAccount)
      if (lastAccount != null) {
        try {
          const loginInfo = await getAccount(false)
          if (loginInfo != null) {
            setMetadata(presentation.metadata.Token, loginInfo.token)
            setMetadataLocalStorage(login.metadata.LoginAccount, loginInfo.account)
            updatePageLoc(getCurrentLocation())
          }
        } catch (err: any) {
          // do nothing
        }
      }
    }
  }

  onMount(chooseToken)
</script>

{#if page === 'admin'}
  <AdminWorkspaces />
{:else}
  <div class="login w-full h-full">
    <BrandPanel />
    <div class="login-pane">
    <div class="login-column">
      <!-- Shown only when the brand panel is hidden (narrow screens). -->
      <img class="compact-logo" src="/tin/tin-logo.png" alt="TIN Projects" width="60" height="40" />
      <div class="login-card">
        <Scroller padding={'1rem 0'}>
          <div class="form-content">
            {#if page === 'login'}
              {#if localLoginHidden}
                <ProvidersOnlyForm />
              {:else}
                <LoginForm {navigateUrl} {signUpDisabled} {useOTP} />
              {/if}
            {:else if page === 'signup'}
              <SignupForm {navigateUrl} {signUpDisabled} {localLoginHidden} {useOTP} />
            {:else if page === 'createWorkspace'}
              <CreateWorkspaceForm />
            {:else if page === 'password'}
              <PasswordRequest {signUpDisabled} />
            {:else if page === 'recovery'}
              <PasswordRestore />
            {:else if page === 'selectWorkspace'}
              <SelectWorkspace {navigateUrl} />
            {:else if page === 'join'}
              <Join />
            {:else if page === 'autoJoin'}
              <AutoJoin />
            {:else if page === 'confirm'}
              <Confirmation />
            {:else if page === 'confirmationSend'}
              <ConfirmationSend />
            {:else if page === 'auth'}
              <Auth />
            {:else if page === 'changePassword'}
              <ChangePassword />
            {:else if page === 'tfa'}
              <LoginTfaForm {navigateUrl} token={tfaToken} on:back={() => (page = 'login')} />
            {/if}
          </div>
        </Scroller>
        {#if $loginFooterActions.length > 0}
          <div class="login-footer">
            {#each $loginFooterActions as footerAction (footerAction.i18n)}
              <BottomActionComponent action={footerAction} />
            {/each}
          </div>
        {/if}
      </div>
      <a class="by-tin" href="https://tin.info" target="_blank" rel="noopener">
        A product by <img src="/tin/tin-logo.png" alt="TIN" width="30" height="20" />
      </a>
    </div>
    </div>

    <Popup />
  </div>
{/if}

<style lang="scss">
  // Brand panel on the left, sign-in on the right (BrandPanel hides itself below 900px).
  .login {
    position: relative;
    display: flex;
    background-color: var(--theme-comp-header-color);
    box-sizing: border-box;
  }

  .login-pane {
    flex: 1 1 28rem;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    box-sizing: border-box;
  }

  .compact-logo {
    display: none;
  }
  @media (max-width: 900px) {
    .compact-logo {
      display: block;
    }
  }

  .by-tin {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--theme-dark-color);

    &:hover {
      text-decoration: none;
      color: var(--theme-caption-color);
    }
  }

  .login-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 30rem;
    min-width: 0;
    gap: 1.75rem;
  }

  .login-card {
    position: relative;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border-radius: 1.25rem;
    background-color: var(--theme-comp-header-color);
    animation: card-enter 0.8s 0.15s cubic-bezier(0.22, 0.61, 0.36, 1) both;

    // Bounded so long content (e.g. a workspace list) scrolls internally
    // instead of the whole page growing without limit.
    display: flex;
    flex-direction: column;
    max-height: min(38rem, calc(100vh - 8rem));
    overflow: hidden;
  }

  .form-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex-grow: 1;
    min-height: 0;
    min-width: 0;
    height: max-content;
  }

  .login-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    padding: 1rem 2rem 1.25rem;
    text-align: center;
    font-size: 0.8125rem;
  }

  // Soft fields with a blue focus ring inside the card: soft fill, blue focus ring.
  .login-card :global(.editbox) {
    background-color: var(--theme-bg-color);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .login-card :global(.editbox:focus-within) {
    background-color: var(--theme-comp-header-color);
    border-color: var(--primary-button-default);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-button-default) 14%, transparent);
  }
  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(18px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .login-card {
      animation: none;
    }
  }
  @media (max-width: 480px) {
    .login-pane {
      padding: 1rem 0.75rem;
    }
  }
</style>
