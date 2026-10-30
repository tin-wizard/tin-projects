// SPDX-License-Identifier: EPL-2.0

import type { MarkupOperations, RestClient } from '@hcengineering/api-client'
import chunter from '@hcengineering/chunter'
import contact from '@hcengineering/contact'
import core, { generateId, SortingOrder, type Doc, type Ref, type Status, type TxOperations } from '@hcengineering/core'
import document, { type Document, type Teamspace } from '@hcengineering/document'
import { makeRank } from '@hcengineering/rank'
import { tokenHasScope, type ApiTokenScope, type Token } from '@hcengineering/server-token'
import task, { type TaskType } from '@hcengineering/task'
import { jsonToMarkup } from '@hcengineering/text'
import { markdownToMarkup } from '@hcengineering/text-markdown'
import tracker, { IssuePriority, MilestoneStatus, type Issue, type Milestone, type Project } from '@hcengineering/tracker'
import { z } from 'zod'

export interface ToolContext {
  client: RestClient
  markup: MarkupOperations
  // Loads the workspace model, so it's only requested by tools that write.
  ops: () => Promise<TxOperations>
}

export interface Tool {
  name: string
  description: string
  // The token needs all of these. This only decides what the client is offered:
  // the transactor and collaborator enforce the same scopes on every call.
  scopes: ApiTokenScope[]
  input: z.ZodRawShape
  destructive?: boolean
  run: (ctx: ToolContext, args: any) => Promise<unknown>
}

const limit = z.number().int().min(1).max(200).default(50).describe('Maximum results')
const priorities = ['NoPriority', 'Urgent', 'High', 'Medium', 'Low'] as const
const milestoneStatuses = ['Planned', 'InProgress', 'Completed', 'Canceled'] as const
const date = z.iso.datetime({ offset: true }).or(z.iso.date())

function toMarkup (markdown: string): string {
  return jsonToMarkup(markdownToMarkup(markdown, { refUrl: '', imageUrl: '' }))
}

async function findProject (ctx: ToolContext, identifier: string): Promise<Project> {
  const project = await ctx.client.findOne(tracker.class.Project, { identifier: identifier.toUpperCase() })
  if (project === undefined) throw new Error(`Project ${identifier} not found`)
  return project
}

async function findIssue (ctx: ToolContext, identifier: string): Promise<Issue> {
  const issue = await ctx.client.findOne(tracker.class.Issue, { identifier: identifier.toUpperCase() })
  if (issue === undefined) throw new Error(`Issue ${identifier} not found`)
  return issue
}

async function findDocument (ctx: ToolContext, id: string): Promise<Document> {
  const doc = await ctx.client.findOne(document.class.Document, { _id: id as Ref<Document> })
  if (doc === undefined) throw new Error(`Document ${id} not found`)
  return doc
}

async function findMilestone (ctx: ToolContext, id: string): Promise<Milestone> {
  const milestone = await ctx.client.findOne(tracker.class.Milestone, { _id: id as Ref<Milestone> })
  if (milestone === undefined) throw new Error(`Milestone ${id} not found`)
  return milestone
}

async function statusesOf (ctx: ToolContext, kind: Ref<TaskType>): Promise<Status[]> {
  const type = await ctx.client.findOne(task.class.TaskType, { _id: kind })
  if (type === undefined) throw new Error('Issue type not found')
  return await ctx.client.findAll(core.class.Status, { _id: { $in: type.statuses } })
}

async function findStatus (ctx: ToolContext, kind: Ref<TaskType>, name: string): Promise<Ref<Status>> {
  const statuses = await statusesOf(ctx, kind)
  const status = statuses.find((it) => it.name.toLowerCase() === name.toLowerCase())
  if (status === undefined) {
    throw new Error(`Unknown status "${name}". Use one of: ${statuses.map((it) => it.name).join(', ')}`)
  }
  return status._id
}

function issueSummary (issue: Issue): Record<string, unknown> {
  return {
    identifier: issue.identifier,
    title: issue.title,
    status: issue.status,
    priority: IssuePriority[issue.priority],
    assignee: issue.assignee,
    milestone: issue.milestone,
    dueDate: issue.dueDate
  }
}

function milestoneSummary (milestone: Milestone): Record<string, unknown> {
  return {
    id: milestone._id,
    label: milestone.label,
    status: MilestoneStatus[milestone.status],
    targetDate: milestone.targetDate
  }
}

async function addComment (ctx: ToolContext, target: Doc, collection: string, markdown: string): Promise<void> {
  const ops = await ctx.ops()
  await ops.addCollection(chunter.class.ChatMessage, target.space, target._id, target._class, collection, {
    message: toMarkup(markdown)
  })
}

export const tools: Tool[] = [
  {
    name: 'list_projects',
    description: 'List the projects visible to this key.',
    scopes: ['read'],
    input: {},
    run: async (ctx) => {
      const projects = await ctx.client.findAll(tracker.class.Project, { archived: false })
      return projects.map((it) => ({ identifier: it.identifier, name: it.name, description: it.description }))
    }
  },
  {
    name: 'list_members',
    description: 'List workspace members. Use the id as an issue assignee.',
    scopes: ['read'],
    input: {},
    run: async (ctx) => {
      const employees = await ctx.client.findAll(contact.mixin.Employee, { active: true })
      return employees.map((it) => ({ id: it._id, name: it.name.split(',').reverse().join(' ').trim() }))
    }
  },
  {
    name: 'list_issue_statuses',
    description: 'List the status names an issue in this project can have.',
    scopes: ['read'],
    input: { project: z.string().describe('Project identifier, such as KON') },
    run: async (ctx, args) => {
      const project = await findProject(ctx, args.project)
      const type = await ctx.client.findOne(task.class.TaskType, { parent: project.type })
      if (type === undefined) throw new Error('Issue type not found')
      return (await statusesOf(ctx, type._id)).map((it) => ({ id: it._id, name: it.name }))
    }
  },
  {
    name: 'list_issues',
    description: 'List issues in a project, newest first, optionally filtered by assignee or milestone.',
    scopes: ['read'],
    input: {
      project: z.string().describe('Project identifier, such as KON'),
      assignee: z.string().optional().describe('Member id from list_members'),
      milestone: z.string().optional().describe('Milestone id from list_milestones'),
      limit
    },
    run: async (ctx, args) => {
      const project = await findProject(ctx, args.project)
      const issues = await ctx.client.findAll(
        tracker.class.Issue,
        {
          space: project._id,
          ...(args.assignee !== undefined ? { assignee: args.assignee } : {}),
          ...(args.milestone !== undefined ? { milestone: args.milestone } : {})
        },
        { limit: args.limit, sort: { modifiedOn: SortingOrder.Descending } }
      )
      return issues.map(issueSummary)
    }
  },
  {
    name: 'get_issue',
    description: 'Read one issue, including its description as Markdown.',
    scopes: ['read'],
    input: { identifier: z.string().describe('Issue identifier, such as KON-12') },
    run: async (ctx, args) => {
      const issue = await findIssue(ctx, args.identifier)
      const description =
        issue.description != null
          ? await ctx.markup.fetchMarkup(tracker.class.Issue, issue._id, 'description', issue.description, 'markdown')
          : ''
      return { ...issueSummary(issue), description }
    }
  },
  {
    name: 'create_issue',
    description: 'Create an issue in a project.',
    scopes: ['read', 'issues:write'],
    input: {
      project: z.string().describe('Project identifier, such as KON'),
      title: z.string().min(1),
      description: z.string().optional().describe('Markdown'),
      priority: z.enum(priorities).optional(),
      assignee: z.string().optional().describe('Member id from list_members'),
      milestone: z.string().optional().describe('Milestone id from list_milestones'),
      dueDate: date.optional()
    },
    run: async (ctx, args) => {
      const project = await findProject(ctx, args.project)
      const kind = await ctx.client.findOne(task.class.TaskType, { parent: project.type })
      if (kind === undefined) throw new Error('Issue type not found')
      const last = await ctx.client.findOne(
        tracker.class.Issue,
        { space: project._id },
        { sort: { rank: SortingOrder.Descending } }
      )
      const ops = await ctx.ops()
      const inc = await ops.updateDoc(tracker.class.Project, core.space.Space, project._id, { $inc: { sequence: 1 } }, true)
      const number = (inc as { object: Project }).object.sequence
      const identifier = `${project.identifier}-${number}`
      const status = project.defaultIssueStatus ?? (await statusesOf(ctx, kind._id))[0]?._id
      if (status === undefined) throw new Error('This project has no issue statuses')
      const id = generateId<Issue>()
      await ops.addCollection(
        tracker.class.Issue,
        project._id,
        tracker.ids.NoParent,
        tracker.class.Issue,
        'subIssues',
        {
          title: args.title,
          description: null,
          assignee: args.assignee ?? project.defaultAssignee ?? null,
          component: null,
          milestone: args.milestone ?? null,
          number,
          status,
          priority: IssuePriority[(args.priority ?? 'NoPriority') as keyof typeof IssuePriority],
          rank: makeRank(last?.rank, undefined),
          comments: 0,
          subIssues: 0,
          startDate: null,
          dueDate: args.dueDate !== undefined ? new Date(args.dueDate).getTime() : null,
          parents: [],
          remainingTime: 0,
          estimation: 0,
          reportedTime: 0,
          reports: 0,
          childInfo: [],
          identifier,
          kind: kind._id
        },
        id
      )
      // After the issue exists, because limited keys can only write content of existing objects.
      if (args.description !== undefined) {
        const description = await ctx.markup.uploadMarkup(
          tracker.class.Issue,
          id,
          'description',
          args.description,
          'markdown'
        )
        await ops.updateDoc(tracker.class.Issue, project._id, id, { description })
      }
      return { identifier, title: args.title }
    }
  },
  {
    name: 'update_issue',
    description: 'Change an issue. Only the fields you pass change.',
    scopes: ['read', 'issues:write'],
    input: {
      identifier: z.string().describe('Issue identifier, such as KON-12'),
      title: z.string().min(1).optional(),
      description: z.string().optional().describe('Markdown, replaces the current description'),
      status: z.string().optional().describe('Status name from list_issue_statuses'),
      priority: z.enum(priorities).optional(),
      assignee: z.string().nullable().optional().describe('Member id from list_members, or null to unassign'),
      milestone: z.string().nullable().optional().describe('Milestone id, or null to remove'),
      dueDate: date.nullable().optional()
    },
    run: async (ctx, args) => {
      const issue = await findIssue(ctx, args.identifier)
      const changes: Record<string, unknown> = {}
      if (args.title !== undefined) changes.title = args.title
      if (args.status !== undefined) changes.status = await findStatus(ctx, issue.kind, args.status)
      if (args.priority !== undefined) changes.priority = IssuePriority[args.priority as keyof typeof IssuePriority]
      if (args.assignee !== undefined) changes.assignee = args.assignee
      if (args.milestone !== undefined) changes.milestone = args.milestone
      if (args.dueDate !== undefined) changes.dueDate = args.dueDate === null ? null : new Date(args.dueDate).getTime()
      if (args.description !== undefined) {
        if (issue.description != null) {
          await ctx.markup.updateMarkup(tracker.class.Issue, issue._id, 'description', args.description, 'markdown')
        } else {
          changes.description = await ctx.markup.uploadMarkup(
            tracker.class.Issue,
            issue._id,
            'description',
            args.description,
            'markdown'
          )
        }
      }
      if (Object.keys(changes).length > 0) {
        const ops = await ctx.ops()
        await ops.updateDoc(tracker.class.Issue, issue.space, issue._id, changes)
      }
      return { identifier: issue.identifier, changed: true }
    }
  },
  {
    name: 'comment_on_issue',
    description: 'Add a comment to an issue.',
    scopes: ['read', 'issues:write'],
    input: { identifier: z.string(), text: z.string().min(1).describe('Markdown') },
    run: async (ctx, args) => {
      await addComment(ctx, await findIssue(ctx, args.identifier), 'comments', args.text)
      return { identifier: args.identifier, commented: true }
    }
  },
  {
    name: 'delete_issue',
    description: 'Permanently delete an issue. This cannot be undone from here.',
    scopes: ['read', 'issues:write', 'delete'],
    destructive: true,
    input: { identifier: z.string() },
    run: async (ctx, args) => {
      const issue = await findIssue(ctx, args.identifier)
      const ops = await ctx.ops()
      await ops.remove(issue)
      return { identifier: issue.identifier, deleted: true }
    }
  },
  {
    name: 'list_milestones',
    description: 'List the milestones of a project.',
    scopes: ['read'],
    input: { project: z.string().describe('Project identifier, such as KON') },
    run: async (ctx, args) => {
      const project = await findProject(ctx, args.project)
      const milestones = await ctx.client.findAll(tracker.class.Milestone, { space: project._id })
      return milestones.map(milestoneSummary)
    }
  },
  {
    name: 'create_milestone',
    description: 'Create a milestone in a project.',
    scopes: ['read', 'issues:write'],
    input: {
      project: z.string().describe('Project identifier, such as KON'),
      label: z.string().min(1),
      targetDate: date,
      status: z.enum(milestoneStatuses).optional()
    },
    run: async (ctx, args) => {
      const project = await findProject(ctx, args.project)
      const ops = await ctx.ops()
      const id = await ops.createDoc(tracker.class.Milestone, project._id, {
        label: args.label,
        status: MilestoneStatus[(args.status ?? 'Planned') as keyof typeof MilestoneStatus],
        comments: 0,
        startDate: null,
        targetDate: new Date(args.targetDate).getTime()
      })
      return { id, label: args.label }
    }
  },
  {
    name: 'update_milestone',
    description: 'Change a milestone. Only the fields you pass change.',
    scopes: ['read', 'issues:write'],
    input: {
      id: z.string().describe('Milestone id from list_milestones'),
      label: z.string().min(1).optional(),
      targetDate: date.optional(),
      status: z.enum(milestoneStatuses).optional()
    },
    run: async (ctx, args) => {
      const milestone = await findMilestone(ctx, args.id)
      const changes: Record<string, unknown> = {}
      if (args.label !== undefined) changes.label = args.label
      if (args.targetDate !== undefined) changes.targetDate = new Date(args.targetDate).getTime()
      if (args.status !== undefined) changes.status = MilestoneStatus[args.status as keyof typeof MilestoneStatus]
      const ops = await ctx.ops()
      await ops.updateDoc(tracker.class.Milestone, milestone.space, milestone._id, changes)
      return { id: milestone._id, changed: true }
    }
  },
  {
    name: 'list_teamspaces',
    description: 'List the document teamspaces visible to this key.',
    scopes: ['read'],
    input: {},
    run: async (ctx) => {
      const spaces = await ctx.client.findAll(document.class.Teamspace, { archived: false })
      return spaces.map((it) => ({ id: it._id, name: it.name }))
    }
  },
  {
    name: 'list_documents',
    description: 'List the documents in a teamspace.',
    scopes: ['read'],
    input: { teamspace: z.string().describe('Teamspace id from list_teamspaces'), limit },
    run: async (ctx, args) => {
      const docs = await ctx.client.findAll(
        document.class.Document,
        { space: args.teamspace as Ref<Teamspace> },
        { limit: args.limit, sort: { modifiedOn: SortingOrder.Descending } }
      )
      return docs.map((it) => ({ id: it._id, title: it.title, parent: it.parent }))
    }
  },
  {
    name: 'get_document',
    description: 'Read one document as Markdown.',
    scopes: ['read'],
    input: { id: z.string().describe('Document id') },
    run: async (ctx, args) => {
      const doc = await findDocument(ctx, args.id)
      const content =
        doc.content != null
          ? await ctx.markup.fetchMarkup(document.class.Document, doc._id, 'content', doc.content, 'markdown')
          : ''
      return { id: doc._id, title: doc.title, content }
    }
  },
  {
    name: 'create_document',
    description: 'Create a document in a teamspace.',
    scopes: ['read', 'documents:write'],
    input: {
      teamspace: z.string().describe('Teamspace id from list_teamspaces'),
      title: z.string().min(1),
      content: z.string().optional().describe('Markdown'),
      parent: z.string().optional().describe('Parent document id')
    },
    run: async (ctx, args) => {
      const space = args.teamspace as Ref<Teamspace>
      const parent = (args.parent ?? document.ids.NoParent) as Ref<Document>
      const first = await ctx.client.findOne(
        document.class.Document,
        { space, parent },
        { sort: { rank: SortingOrder.Ascending } }
      )
      const id = generateId<Document>()
      const ops = await ctx.ops()
      await ops.createDoc(
        document.class.Document,
        space,
        {
          title: args.title,
          content: null,
          parent,
          rank: makeRank(undefined, first?.rank),
          attachments: 0,
          embeddings: 0,
          labels: 0,
          comments: 0,
          references: 0
        },
        id
      )
      // After the document exists, because limited keys can only write content of existing objects.
      if (args.content !== undefined) {
        const content = await ctx.markup.uploadMarkup(document.class.Document, id, 'content', args.content, 'markdown')
        await ops.updateDoc(document.class.Document, space, id, { content })
      }
      return { id, title: args.title }
    }
  },
  {
    name: 'update_document',
    description: 'Change a document. Content replaces the whole body.',
    scopes: ['read', 'documents:write'],
    input: {
      id: z.string().describe('Document id'),
      title: z.string().min(1).optional(),
      content: z.string().optional().describe('Markdown')
    },
    run: async (ctx, args) => {
      const doc = await findDocument(ctx, args.id)
      const changes: Record<string, unknown> = {}
      if (args.title !== undefined) changes.title = args.title
      if (args.content !== undefined) {
        if (doc.content != null) {
          await ctx.markup.updateMarkup(document.class.Document, doc._id, 'content', args.content, 'markdown')
        } else {
          changes.content = await ctx.markup.uploadMarkup(
            document.class.Document,
            doc._id,
            'content',
            args.content,
            'markdown'
          )
        }
      }
      if (Object.keys(changes).length > 0) {
        const ops = await ctx.ops()
        await ops.updateDoc(document.class.Document, doc.space, doc._id, changes)
      }
      return { id: doc._id, changed: true }
    }
  },
  {
    name: 'delete_document',
    description: 'Permanently delete a document. This cannot be undone from here.',
    scopes: ['read', 'documents:write', 'delete'],
    destructive: true,
    input: { id: z.string().describe('Document id') },
    run: async (ctx, args) => {
      const doc = await findDocument(ctx, args.id)
      const ops = await ctx.ops()
      await ops.remove(doc)
      return { id: doc._id, deleted: true }
    }
  }
]

export function toolsForToken (token: Pick<Token, 'extra'>): Tool[] {
  return tools.filter((tool) => tool.scopes.every((scope) => tokenHasScope(token, scope)))
}
