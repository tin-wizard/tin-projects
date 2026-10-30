<!--
// Copyright © 2022 Hardcore Engineering Inc.
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
  import { AvatarType, Channel, combineName, ContactEvents, Employee, Person, SocialIdentityRef } from '@hcengineering/contact'
  import {
    AccountRole,
    AttachedData,
    buildSocialIdString,
    Data,
    generateId,
    getCurrentAccount,
    hasAccountRole,
    Ref,
    SocialIdType
  } from '@hcengineering/core'
  import login from '@hcengineering/login'
  import { getEmbeddedLabel, getMetadata } from '@hcengineering/platform'
  import presentation, { Card, getClient } from '@hcengineering/presentation'
  import {
    Button,
    createFocusManager,
    DropdownLabelsIntl,
    type DropdownIntlItem,
    EditBox,
    FocusHandler,
    IconCheck,
    IconInfo,
    Label,
    showPopup
  } from '@hcengineering/ui'
  import { createEventDispatcher, onMount } from 'svelte'
  import contact from '../plugin'
  import { employeeBySocialKeyStore, getAccountClient } from '../utils'
  import { Analytics } from '@hcengineering/analytics'

  export let canSave: boolean = true
  export let onCreate: ((id: Ref<Employee>) => Promise<void>) | undefined = undefined

  type Status = 'form' | 'notSent' | 'sent'

  let firstName = ''
  let lastName = ''
  let email = ''
  let role: AccountRole = AccountRole.User
  let status: Status = 'form'
  let contactFailed = false
  let saving = false
  let id: Ref<Employee> = generateId()

  const account = getCurrentAccount()
  // This metadata holds the URL name ("tinpcqa"), so replace it with the display name once loaded.
  let workspace = getMetadata(presentation.metadata.WorkspaceName) ?? ''
  // Invite links default to Maintainer and above; see DEFAULT_INVITE_LINK_GENERATOR_ROLES.
  const canCopyLink = hasAccountRole(account, AccountRole.Maintainer)
  const roleItems: DropdownIntlItem[] = [
    { id: AccountRole.User, label: contact.string.InviteRoleUser },
    ...(canCopyLink ? [{ id: AccountRole.Maintainer, label: contact.string.InviteRoleMaintainer }] : []),
    { id: AccountRole.Guest, label: contact.string.InviteRoleGuest }
  ]

  export function canClose(): boolean {
    return status === 'sent' || (firstName === '' && lastName === '' && email === '')
  }

  const dispatch = createEventDispatcher()
  const client = getClient()
  const accountClient = getAccountClient()

  onMount(() => {
    void accountClient.getWorkspaceInfo().then((info) => {
      workspace = info.name ?? workspace
    })
  })

  async function addContact(mail: string, socialString: string): Promise<void> {
    const existingId = await client.findOne(contact.class.SocialIdentity, { key: socialString })
    const existingPerson =
      existingId !== undefined
        ? await client.findOne(contact.class.Person, { _id: existingId.attachedTo })
        : undefined
    if (existingPerson !== undefined && client.getHierarchy().hasMixin(existingPerson, contact.mixin.Employee)) {
      return
    }

    // The name is optional in this dialog, so fall back to the part of the address before the @.
    const first = firstName.trim() !== '' ? firstName.trim() : mail.split('@')[0]
    const last = lastName.trim()
    const { uuid, socialId } = await accountClient.ensurePerson(SocialIdType.EMAIL, mail, first, last)

    const person: Data<Person> = {
      name: combineName(first, last),
      city: '',
      avatarType: AvatarType.COLOR,
      personUuid: uuid
    }

    if (existingPerson === undefined) {
      await client.createDoc(contact.class.Person, contact.space.Contacts, person, id)
    } else {
      await client.update(existingPerson, person)
    }
    const employeeRef = (existingPerson?._id as Ref<Employee>) ?? id

    await client.createMixin(employeeRef, contact.class.Person, contact.space.Contacts, contact.mixin.Employee, {
      active: true,
      role
    })

    await client.addCollection(
      contact.class.SocialIdentity,
      contact.space.Contacts,
      employeeRef,
      contact.class.Person,
      'socialIds',
      {
        type: SocialIdType.EMAIL,
        value: mail,
        key: socialString
      },
      socialId as SocialIdentityRef
    )

    const channel: AttachedData<Channel> = { provider: contact.channelProvider.Email, value: mail }
    await client.addCollection(contact.class.Channel, contact.space.Contacts, employeeRef, contact.class.Person, 'channels', channel)

    if (onCreate != null) {
      await onCreate(employeeRef)
    }
    Analytics.handleEvent(ContactEvents.EmployeeCreated, { id: employeeRef, email: mail })
  }

  async function sendInvite(): Promise<void> {
    if (!canSend) return
    saving = true
    contactFailed = false
    const mail = email.trim()
    try {
      // Send first, so a failed send doesn't leave someone in the list who was never invited.
      try {
        await accountClient.sendInvite(mail, role)
      } catch (err: any) {
        Analytics.handleError(err)
        status = 'notSent'
        return
      }
      status = 'sent'
      try {
        await addContact(mail, emailSocialString)
      } catch (err: any) {
        Analytics.handleError(err)
        contactFailed = true
      }
    } finally {
      saving = false
    }
  }

  function inviteAnother(): void {
    firstName = ''
    lastName = ''
    email = ''
    role = AccountRole.User
    status = 'form'
    contactFailed = false
    id = generateId()
    manager.setFocusPos(1)
  }

  function copyLink(): void {
    showPopup(login.component.InviteLink, {})
  }

  $: emailSocialString = buildSocialIdString({
    type: SocialIdType.EMAIL,
    value: email.trim()
  })
  $: exists = $employeeBySocialKeyStore.get(emailSocialString) !== undefined
  $: validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  $: canSend = validEmail && !exists && canSave && !saving

  const manager = createFocusManager()
</script>

<FocusHandler {manager} />

<!-- canSave is off on Card because it closes itself after okAction, and this dialog stays open to show the result. -->
<Card
  label={status === 'sent' ? contact.string.InviteSent : contact.string.InviteToWorkspace}
  labelProps={{ workspace }}
  okAction={sendInvite}
  canSave={false}
  width={'small'}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  {#if status === 'sent'}
    <div class="sent" role="status">
      <div class="sent-icon"><IconCheck size={'large'} /></div>
      <Label label={contact.string.InviteSentDetail} params={{ email: email.trim() }} />
      {#if contactFailed}
        <div class="message"><Label label={contact.string.InviteContactFailed} /></div>
      {/if}
    </div>
  {:else}
    <div class="description"><Label label={contact.string.InviteDescription} /></div>
    <div class="field">
      <span class="field-label"><Label label={contact.string.InviteEmailAddress} /></span>
      <EditBox kind={'default-large'} placeholder={getEmbeddedLabel('name@company.com')} bind:value={email} autoFocus focusIndex={1} />
    </div>
    <div class="names">
      <div class="field">
        <span class="field-label"><Label label={contact.string.PersonFirstNamePlaceholder} /></span>
        <EditBox kind={'default-large'} placeholder={contact.string.PersonFirstNamePlaceholder} bind:value={firstName} focusIndex={2} />
      </div>
      <div class="field">
        <span class="field-label"><Label label={contact.string.PersonLastNamePlaceholder} /></span>
        <EditBox kind={'default-large'} placeholder={contact.string.PersonLastNamePlaceholder} bind:value={lastName} focusIndex={3} />
      </div>
    </div>
    <div class="field">
      <span class="field-label"><Label label={contact.string.Role} /></span>
      <DropdownLabelsIntl
        kind={'regular'}
        size={'large'}
        width={'100%'}
        justify={'left'}
        items={roleItems}
        focusIndex={4}
        bind:selected={role}
      />
    </div>
    {#if exists && !saving}
      <div class="message" role="alert">
        <IconInfo size={'small'} />
        <Label label={contact.string.PersonAlreadyExists} />
      </div>
    {:else if status === 'notSent'}
      <div class="message" role="alert">
        <strong><Label label={contact.string.InviteNotSent} /></strong>
        <Label label={contact.string.InviteNotSentDetail} />
      </div>
    {/if}
  {/if}
  <svelte:fragment slot="footer">
    {#if status !== 'sent' && canCopyLink}
      <Button kind={'ghost'} size={'large'} label={contact.string.CopyInviteLinkInstead} on:click={copyLink} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="after-buttons">
    {#if status === 'sent'}
      <Button kind={'regular'} size={'large'} label={contact.string.InviteAnother} on:click={inviteAnother} />
      <Button
        kind={'primary'}
        size={'large'}
        label={contact.string.InviteDone}
        on:click={() => {
          dispatch('close', id)
        }}
      />
    {:else}
      <Button
        kind={'regular'}
        size={'large'}
        label={presentation.string.Cancel}
        on:click={() => {
          dispatch('close')
        }}
      />
      <Button
        kind={'primary'}
        size={'large'}
        focusIndex={5}
        disabled={!canSend}
        loading={saving}
        label={status === 'notSent' ? contact.string.TryAgain : contact.string.SendInvite}
        on:click={sendInvite}
      />
    {/if}
  </svelte:fragment>
</Card>

<style lang="scss">
  .description {
    color: var(--theme-dark-color);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
    margin-top: 1rem;
  }
  .field-label {
    font-weight: 500;
    color: var(--theme-caption-color);
  }
  .names {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .message {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.375rem;
    margin-top: 1rem;
    padding: 0.625rem 0.75rem;
    border-radius: var(--medium-BorderRadius);
    background-color: var(--theme-state-negative-background-color);
    color: var(--theme-state-negative-color);
  }
  .sent {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow-wrap: anywhere;
    padding: 0.5rem 0;
    color: var(--theme-content-color);
  }
  .sent-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.25rem;
    height: 3.25rem;
    margin-bottom: 0.875rem;
    border-radius: 50%;
    background-color: var(--theme-state-positive-background-color);
    color: var(--theme-state-positive-color);
  }
</style>
