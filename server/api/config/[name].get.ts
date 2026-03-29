import { join } from 'pathe'
import { readFile } from 'node:fs/promises'

const CONFIG_DIR = join(process.cwd(), 'server/lib/rules/config')

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  if (!name || !/^[\w\-.]+$/.test(name)) {
    throw createError({ statusCode: 400, message: 'Invalid config name' })
  }

  const filePath = join(CONFIG_DIR, name.endsWith('.ini') ? name : `${name}.ini`)

  try {
    const content = await readFile(filePath, 'utf-8')
    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    setHeader(event, 'Cache-Control', 'public, max-age=3600')
    return content
  }
  catch {
    throw createError({ statusCode: 404, message: `Config not found: ${name}` })
  }
})
