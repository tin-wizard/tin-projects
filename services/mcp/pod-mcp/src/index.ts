// SPDX-License-Identifier: EPL-2.0

import { createMarkupOperations, createRestClient, createRestTxOperations } from '@hcengineering/api-client'
import { type TxOperations } from '@hcengineering/core'
import { decodeToken, type Token } from '@hcengineering/server-token'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { toolsForToken, type ToolContext } from './tools'

const PORT = parseInt(process.env.PORT ?? '4020')
const TRANSACTOR_URL = process.env.TRANSACTOR_URL ?? 'http://transactor:3333'
const COLLABORATOR_URL = process.env.COLLABORATOR_URL ?? 'http://collaborator:3078'
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'http://localhost'
const MAX_BODY = 4 * 1024 * 1024

class BodyTooLarge extends Error {}

async function readJson (req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new BodyTooLarge()
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function send (res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }))
}

function buildServer (rawToken: string, token: Token): McpServer {
  const workspace = token.workspace
  const client = createRestClient(TRANSACTOR_URL, workspace, rawToken)
  const markup = createMarkupOperations(PUBLIC_URL, workspace, rawToken, {
    ACCOUNTS_URL: '',
    COLLABORATOR_URL,
    FILES_URL: '',
    UPLOAD_URL: ''
  })
  let ops: Promise<TxOperations> | undefined
  const ctx: ToolContext = {
    client,
    markup,
    ops: async () => {
      ops ??= createRestTxOperations(TRANSACTOR_URL, workspace, rawToken)
      return await ops
    }
  }

  const server = new McpServer({ name: 'tin-projects', version: '1.0.0' })
  for (const tool of toolsForToken(token)) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.input,
        annotations: { readOnlyHint: tool.scopes.length === 1, destructiveHint: tool.destructive === true }
      },
      async (args: unknown) => {
        try {
          const result = await tool.run(ctx, args)
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
        } catch (err: any) {
          return { isError: true, content: [{ type: 'text' as const, text: String(err?.message ?? err) }] }
        }
      }
    )
  }
  return server
}

async function handle (req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path === '/health') {
    res.writeHead(200).end('ok')
    return
  }
  // Stateless: every request brings its key, so there are no sessions to open or stream.
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' }).end()
    return
  }

  const header = req.headers.authorization ?? ''
  const rawToken = header.startsWith('Bearer ') ? header.slice(7) : ''
  let token: Token
  try {
    // Not verified here because this service holds no secret. The transactor verifies it next,
    // and again on every call a tool makes, along with its expiry, revocation and scopes.
    token = decodeToken(rawToken, false)
    await createRestClient(TRANSACTOR_URL, token.workspace, rawToken).getAccount()
  } catch {
    res.setHeader('WWW-Authenticate', 'Bearer')
    send(res, 401, 'A valid TIN Projects API key is required')
    return
  }

  const body = await readJson(req)
  const server = buildServer(rawToken, token)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => {
    void transport.close()
    void server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, body)
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (res.headersSent) {
      res.end()
    } else if (err instanceof BodyTooLarge) {
      send(res, 413, 'Request too large')
    } else if (err instanceof SyntaxError) {
      send(res, 400, 'Invalid JSON')
    } else {
      console.error('mcp request failed', err?.message)
      send(res, 500, 'Internal error')
    }
  })
}).listen(PORT, () => {
  console.log(`MCP server listening on ${PORT}`)
})
