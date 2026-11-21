/**
 * GPT-SoVITS voice-reply host for DeepSeek Harness.
 *
 * This file only uses Node built-ins and services supplied by Cordis. The
 * browser half in client.js talks to the same-origin routes registered below.
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'

export const name = 'dsh-voice'
export const inject = ['webServer', 'tools', 'systemPrompt', 'connection']

const PREFIX = '/.dsh-voice'
const DEFAULT_ROOT = 'F:\\GPT-SoVITS-v5'
const MODEL_CACHE_MS = 15_000
const AUDIO_NAME = /^[A-Za-z0-9._-]+\.wav$/
const MAX_TOOL_TEXT = 500
const KEEP_CLIPS = 48
const SKIP_DIRS = new Set([
  '.git',
  '__pycache__',
  'logs',
  'node_modules',
  'output',
  'runtime',
  'TEMP',
  'temp',
  'tools',
])

function asRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(max, Math.max(min, number))
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8')
  renameSync(temporary, path)
}

function profileDirectory(ctx) {
  try {
    const profile = ctx.get('profileContext')
    if (profile !== null && typeof profile === 'object' && typeof profile.dir === 'string' && profile.dir !== '') {
      return profile.dir
    }
  } catch {
    // A minimal test context may not expose profileContext.
  }
  return process.cwd()
}

function insideRoot(root, path) {
  const rel = relative(resolve(root), resolve(path))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function relativeInsideRoot(root, value, label) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const target = isAbsolute(value) ? resolve(value.trim()) : resolve(root, value.trim())
  if (!insideRoot(root, target)) {
    throw new Error(`${label}必须位于 GPT-SoVITS 目录内`)
  }
  return relative(resolve(root), target).replaceAll('\\', '/')
}

function scanFiles(root, predicate, limit = 600, pathRoot = root) {
  const result = []
  const pending = [root]
  while (pending.length > 0 && result.length < limit) {
    const directory = pending.pop()
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (result.length >= limit) break
      const full = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) pending.push(full)
      } else if (entry.isFile() && predicate(entry.name)) {
        result.push(relative(pathRoot, full).replaceAll('\\', '/'))
      }
    }
  }
  return result
}

function referenceTranscripts(root) {
  const transcripts = new Map()
  const logs = join(root, 'logs')
  if (!existsSync(logs)) return transcripts

  const pending = [logs]
  while (pending.length > 0) {
    const directory = pending.pop()
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(directory, entry.name)
      if (entry.isDirectory()) {
        pending.push(full)
        continue
      }
      if (entry.name !== '2-name2text.txt') continue
      let lines
      try {
        lines = readFileSync(full, 'utf8').split(/\r?\n/)
      } catch {
        continue
      }
      for (const line of lines) {
        const cells = line.split('\t')
        if (cells.length < 4) continue
        const audio = basename(cells[0].trim())
        const text = cells[3].trim()
        if (audio !== '' && text !== '') transcripts.set(audio, text)
      }
    }
  }
  return transcripts
}

function scanModels(root) {
  if (!existsSync(root)) {
    return { gpt: [], sovits: [], refAudio: [] }
  }

  let topLevel = []
  try {
    topLevel = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  } catch {
    return { gpt: [], sovits: [], refAudio: [] }
  }

  const gpt = []
  const sovits = []
  for (const entry of topLevel) {
    const full = join(root, entry.name)
    if (entry.name.startsWith('GPT_weights')) {
      gpt.push(...scanFiles(full, (file) => file.toLowerCase().endsWith('.ckpt'), 600, root))
    }
    if (entry.name.startsWith('SoVITS_weights')) {
      sovits.push(...scanFiles(full, (file) => {
        const lower = file.toLowerCase()
        return lower.endsWith('.pth') && !/(^|[_-])d\.pth$/i.test(lower) && !lower.includes('discriminator')
      }, 600, root))
    }
  }

  const pretrained = join(root, 'GPT_SoVITS', 'pretrained_models')
  if (existsSync(pretrained)) {
    let files = []
    try {
      files = readdirSync(pretrained, { withFileTypes: true })
    } catch {
      files = []
    }
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.ckpt')) continue
      if (/^s1/i.test(entry.name)) gpt.push(join('GPT_SoVITS', 'pretrained_models', entry.name).replaceAll('\\', '/'))
    }
  }

  const transcripts = referenceTranscripts(root)
  const refAudio = []
  for (const entry of topLevel) {
    if (entry.name === 'dataset' || entry.name.toLowerCase().includes('reference')) {
      refAudio.push(...scanFiles(join(root, entry.name), (file) => file.toLowerCase().endsWith('.wav'), 800, root))
    }
  }

  const uniqueSorted = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right))
  return {
    gpt: uniqueSorted(gpt),
    sovits: uniqueSorted(sovits),
    refAudio: uniqueSorted(refAudio).map((path) => ({
      path,
      text: transcripts.get(basename(path)) ?? '',
    })),
  }
}

function preferGpt(path) {
  if (/^GPT_weights/i.test(path)) return 0
  if (/s1v3\.ckpt$/i.test(path)) return 1
  if (/s1bert25hz-2kh/i.test(path)) return 2
  if (/s1bert25hz-5kh/i.test(path)) return 3
  return 4
}

function preferSovits(path) {
  if (/^SoVITS_weights_v5turbo\//i.test(path)) return 0
  if (/^SoVITS_weights_v4\//i.test(path)) return 1
  if (/^SoVITS_weights/i.test(path)) return 2
  return 3
}

function inferLanguage(text) {
  if (/[\u3040-\u30ff]/.test(text)) return 'ja'
  if (/[\uac00-\ud7af]/.test(text)) return 'ko'
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh'
  return 'en'
}

function textForSpeech(value) {
  let text = String(value ?? '')
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/https?:\/\/\S+/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/^[#>*+-]+\s*/gm, '')
  text = text.replace(/[`*_~|]/g, ' ')
  text = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

function wavSeconds(buffer) {
  if (buffer.length < 44) return 0
  let offset = 12
  let byteRate = 0
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    if (id === 'fmt ' && offset + 16 <= buffer.length) byteRate = buffer.readUInt32LE(offset + 16)
    if (id === 'data') return byteRate > 0 ? size / byteRate : 0
    offset += 8 + size + (size % 2)
  }
  return byteRate > 0 ? Math.max(0, buffer.length - 44) / byteRate : 0
}

function normalizeConfig(input = {}, previous = {}) {
  const base = {
    root: typeof previous.root === 'string' ? previous.root : DEFAULT_ROOT,
    python: typeof previous.python === 'string' ? previous.python : '',
    port: previous.port ?? 9880,
    gpt: typeof previous.gpt === 'string' ? previous.gpt : '',
    sovits: typeof previous.sovits === 'string' ? previous.sovits : '',
    refAudio: typeof previous.refAudio === 'string' ? previous.refAudio : '',
    promptText: typeof previous.promptText === 'string' ? previous.promptText : '',
    promptLang: typeof previous.promptLang === 'string' ? previous.promptLang : 'zh',
    textLang: typeof previous.textLang === 'string' ? previous.textLang : 'auto',
    speed: previous.speed ?? 1,
    speakEveryReply: previous.speakEveryReply !== false,
    autoPlay: previous.autoPlay !== false,
  }
  const next = { ...base }

  if (typeof input.root === 'string' && input.root.trim() !== '') next.root = resolve(input.root.trim())
  if (typeof input.python === 'string') next.python = input.python.trim()
  if (input.port !== undefined) next.port = Math.round(clamp(input.port, 1024, 65535))
  if (input.speed !== undefined) next.speed = clamp(input.speed, 0.5, 2)
  if (typeof input.speakEveryReply === 'boolean') next.speakEveryReply = input.speakEveryReply
  if (typeof input.autoPlay === 'boolean') next.autoPlay = input.autoPlay

  const stringFields = ['promptText', 'promptLang', 'textLang']
  for (const field of stringFields) {
    if (typeof input[field] === 'string') next[field] = input[field]
  }
  if (!/^(auto|zh|en|ja|ko|yue)$/.test(next.textLang)) next.textLang = 'auto'
  if (!/^(zh|en|ja|ko|yue)$/.test(next.promptLang)) next.promptLang = 'zh'

  for (const [field, label] of [
    ['gpt', 'GPT 模型'],
    ['sovits', 'SoVITS 模型'],
    ['refAudio', '参考音频'],
  ]) {
    if (typeof input[field] === 'string') {
      next[field] = relativeInsideRoot(next.root, input[field], label)
    }
  }
  return next
}

async function errorText(response) {
  const text = await response.text().catch(() => '')
  if (text === '') return `HTTP ${response.status}`
  try {
    const body = JSON.parse(text)
    const message = body?.message ?? body?.detail ?? body?.Exception ?? text
    return `${message} (HTTP ${response.status})`
  } catch {
    return `${text.slice(0, 420)} (HTTP ${response.status})`
  }
}

function sendJson(response, status, value) {
  const payload = JSON.stringify(value)
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(payload)
}

function readBody(request, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size <= limit) {
        chunks.push(chunk)
        return
      }
      reject(Object.assign(new Error('请求内容过大'), { status: 413 }))
      request.destroy()
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

async function readJson(request) {
  const bytes = await readBody(request, 1024 * 1024)
  if (bytes.length === 0) return undefined
  return JSON.parse(bytes.toString('utf8'))
}

function rejectionStatus(ctx, request) {
  let connection
  try {
    connection = ctx.get('connection')
  } catch {
    return undefined
  }
  if (connection === undefined) return undefined
  if (typeof connection.admit === 'function') {
    const admitted = connection.admit(request)
    if (admitted !== null && typeof admitted === 'object' && typeof admitted.rejection === 'number') {
      return admitted.rejection
    }
    return undefined
  }
  if (typeof connection.isAuthenticated === 'function') return connection.isAuthenticated(request) ? undefined : 401
  return undefined
}

export function createVoiceService(ctx, overrides = {}) {
  const profileDir = profileDirectory(ctx)
  const storeDir = join(profileDir, 'dsh-voice')
  const outDir = join(storeDir, 'clips')
  const configPath = join(storeDir, 'config.json')
  const latestPath = join(storeDir, 'latest.json')
  mkdirSync(outDir, { recursive: true })

  const config = normalizeConfig({ ...overrides, ...(readJsonFile(configPath) ?? {}) })
  let latest = readJsonFile(latestPath)
  let modelCache
  let modelCacheAt = 0
  let modelCacheRoot = ''

  const runtime = {
    appliedKey: '',
    child: undefined,
    error: '',
    log: [],
    queue: Promise.resolve(),
    starting: undefined,
  }

  function save() {
    writeJson(configPath, config)
  }

  function logLine(value) {
    const text = String(value ?? '').trimEnd()
    if (text === '') return
    runtime.log.push(text.slice(0, 4_000))
    if (runtime.log.length > 160) runtime.log.splice(0, runtime.log.length - 160)
  }

  function models(force = false) {
    const now = Date.now()
    if (force || modelCache === undefined || modelCacheRoot !== config.root || now - modelCacheAt > MODEL_CACHE_MS) {
      modelCache = scanModels(config.root)
      modelCacheAt = now
      modelCacheRoot = config.root
    }
    return modelCache
  }

  function seed() {
    let found
    try {
      found = models()
    } catch {
      return
    }
    if (config.gpt === '' && found.gpt.length > 0) {
      config.gpt = [...found.gpt].sort((left, right) => preferGpt(left) - preferGpt(right) || left.localeCompare(right))[0]
    }
    if (config.sovits === '' && found.sovits.length > 0) {
      config.sovits = [...found.sovits].sort(
        (left, right) => preferSovits(left) - preferSovits(right) || left.localeCompare(right),
      )[0]
    }
    if (config.refAudio === '' && found.refAudio.length > 0) {
      const reference = found.refAudio.find((entry) => entry.text !== '') ?? found.refAudio[0]
      config.refAudio = reference.path
      if (config.promptText === '' && reference.text !== '') config.promptText = reference.text
    }
    save()
  }

  function pythonPath() {
    if (config.python !== '') return config.python
    const bundled = join(config.root, 'runtime', 'python.exe')
    return existsSync(bundled) ? bundled : 'python'
  }

  function baseUrl() {
    return `http://127.0.0.1:${config.port}`
  }

  async function probe() {
    try {
      const response = await fetch(`${baseUrl()}/openapi.json`, { signal: AbortSignal.timeout(1_500) })
      return response.ok
    } catch {
      return false
    }
  }

  async function start() {
    if (await probe()) {
      runtime.error = ''
      return
    }
    if (runtime.starting !== undefined) return runtime.starting

    runtime.starting = (async () => {
      const api = join(config.root, 'api_v2.py')
      if (!existsSync(api)) {
        throw new Error(`找不到 api_v2.py：${api}。请检查 GPT-SoVITS 目录。`)
      }
      const python = pythonPath()
      logLine(`$ "${python}" api_v2.py -a 127.0.0.1 -p ${config.port}`)
      const child = spawn(
        python,
        [api, '-a', '127.0.0.1', '-p', String(config.port), '-c', 'GPT_SoVITS/configs/tts_infer.yaml'],
        {
          cwd: config.root,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        },
      )
      runtime.child = child
      child.stdout?.setEncoding('utf8')
      child.stderr?.setEncoding('utf8')
      child.stdout?.on('data', (chunk) => logLine(chunk))
      child.stderr?.on('data', (chunk) => logLine(chunk))

      let spawnError
      child.on('error', (error) => {
        spawnError = error
        logLine(`启动失败：${error.message}`)
      })
      child.on('exit', (code, signal) => {
        if (runtime.child === child) runtime.child = undefined
        runtime.appliedKey = ''
        if (code !== 0 && code !== null) {
          runtime.error = `语音服务已退出（code ${code}${signal ? `, ${signal}` : ''}）`
        }
        logLine(`进程退出：code=${code} signal=${signal ?? ''}`)
      })

      const deadline = Date.now() + 240_000
      while (Date.now() < deadline) {
        if (spawnError !== undefined) throw new Error(`无法启动 ${python}：${spawnError.message}`)
        if (await probe()) {
          runtime.error = ''
          return
        }
        await delay(800)
        if (runtime.child === undefined && spawnError === undefined) {
          throw new Error(`语音服务启动后立即退出。\n${runtime.log.slice(-16).join('\n')}`)
        }
      }
      throw new Error(`语音服务在 240 秒内没有就绪。\n${runtime.log.slice(-16).join('\n')}`)
    })()

    try {
      await runtime.starting
    } finally {
      runtime.starting = undefined
    }
  }

  async function stop() {
    runtime.appliedKey = ''
    const child = runtime.child
    runtime.child = undefined
    if (child !== undefined) {
      child.kill()
      return
    }
    try {
      await fetch(`${baseUrl()}/control?command=exit`, { signal: AbortSignal.timeout(2_000) })
    } catch {
      // The API did not expose a control endpoint, or it was already stopped.
    }
  }

  async function ensure() {
    if (!(await probe())) await start()
  }

  async function getJson(path, label) {
    const response = await fetch(`${baseUrl()}${path}`, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`${label}失败：${await errorText(response)}`)
    return response.json().catch(() => ({}))
  }

  async function applyWeights() {
    const key = `${config.gpt}\u0000${config.sovits}`
    if (runtime.appliedKey === key) return
    if (config.gpt !== '') {
      await getJson(`/set_gpt_weights?weights_path=${encodeURIComponent(config.gpt)}`, '切换 GPT 模型')
    }
    if (config.sovits !== '') {
      await getJson(`/set_sovits_weights?weights_path=${encodeURIComponent(config.sovits)}`, '切换 SoVITS 模型')
    }
    runtime.appliedKey = key
  }

  function serialize(task) {
    const next = runtime.queue.then(task, task)
    runtime.queue = next.catch(() => undefined)
    return next
  }

  async function synthesize(value) {
    const cleaned = textForSpeech(value)
    if (cleaned === '') throw new Error('要朗读的文本是空的')
    if (config.refAudio === '') throw new Error('请先在语音设置中选择参考音频')
    if (cleaned.length > MAX_TOOL_TEXT) {
      throw new Error(`单次朗读最多 ${MAX_TOOL_TEXT} 个字符，请缩短内容后重试`)
    }

    return serialize(async () => {
      await ensure()
      await applyWeights()
      const body = {
        text: cleaned,
        text_lang: config.textLang === 'auto' ? inferLanguage(cleaned) : config.textLang,
        ref_audio_path: config.refAudio,
        prompt_text: config.promptText,
        prompt_lang: config.promptLang,
        text_split_method: 'cut5',
        batch_size: 1,
        speed_factor: config.speed,
        media_type: 'wav',
        streaming_mode: false,
        parallel_infer: true,
        repetition_penalty: 1.35,
      }

      let response
      try {
        response = await fetch(`${baseUrl()}/tts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(300_000),
        })
      } catch (error) {
        throw new Error(`请求语音服务失败：${error instanceof Error ? error.message : String(error)}`)
      }
      if (!response.ok) throw new Error(`语音合成失败：${await errorText(response)}`)

      const audio = Buffer.from(await response.arrayBuffer())
      if (audio.length === 0) throw new Error('语音服务返回了空音频')
      const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
      const file = join(outDir, `${id}.wav`)
      writeFileSync(file, audio)
      const seconds = wavSeconds(audio)
      const voice = basename(config.sovits).replace(/\.pth$/i, '') || basename(config.gpt, '.ckpt') || '默认音色'
      latest = {
        at: Date.now(),
        file,
        id,
        seconds,
        text: cleaned,
        url: `${PREFIX}/audio/${id}.wav?v=${id}`,
        voice,
      }
      writeJson(latestPath, latest)
      prune()
      return {
        ...latest,
        message:
          `已生成 ${seconds.toFixed(1)} 秒语音，并作为语音消息嵌入回复。若此前已经输出正文，请直接结束本轮，不要重复正文；若尚未输出正文，请现在只输出一次最终正文。`,
        ok: true,
      }
    })
  }

  function prune() {
    let clips = []
    try {
      clips = readdirSync(outDir)
        .filter((file) => file.toLowerCase().endsWith('.wav'))
        .map((file) => ({ at: statSync(join(outDir, file)).mtimeMs, file }))
    } catch {
      return
    }
    clips.sort((left, right) => right.at - left.at)
    for (const clip of clips.slice(KEEP_CLIPS)) {
      try {
        rmSync(join(outDir, clip.file), { force: true })
      } catch {
        // Best effort; retention is housekeeping, not a correctness guarantee.
      }
    }
  }

  function serverState() {
    return {
      applied: runtime.appliedKey !== '',
      error: runtime.error,
      log: runtime.log.slice(-24),
      pid: runtime.child?.pid,
      port: config.port,
      running: runtime.child !== undefined || runtime.starting !== undefined,
      starting: runtime.starting !== undefined,
    }
  }

  async function snapshot(forceModels = false) {
    const state = serverState()
    if (!state.running) state.running = await probe()
    return {
      config,
      latest,
      models: models(forceModels),
      paths: {
        output: outDir,
        python: pythonPath(),
        root: config.root,
        store: storeDir,
      },
      server: state,
      version: 2,
    }
  }

  function update(input) {
    const value = asRecord(input)
    if (value === undefined) throw new Error('设置内容必须是对象')
    const next = normalizeConfig(value, config)
    if (!existsSync(next.root)) throw new Error(`GPT-SoVITS 目录不存在：${next.root}`)

    for (const [field, label] of [
      ['gpt', 'GPT 模型'],
      ['sovits', 'SoVITS 模型'],
      ['refAudio', '参考音频'],
    ]) {
      if (next[field] !== '' && !existsSync(resolve(next.root, next[field]))) {
        throw new Error(`${label}不存在：${next[field]}`)
      }
    }
    Object.assign(config, next)
    runtime.appliedKey = ''
    modelCache = undefined
    save()
    return snapshot(true)
  }

  async function refresh() {
    modelCache = undefined
    return snapshot(true)
  }

  function promptText() {
    if (!config.speakEveryReply) {
      return [
        '## 语音输出',
        '常规回复使用文字。只有用户明确要求“念出来”或用语音说时，才调用一次 `speak`。',
      ].join('\n')
    }
    return [
      '## 语音回复（GPT-SoVITS）',
      `语音回复已开启，当前音色：${basename(config.sovits).replace(/\.pth$/i, '') || '默认音色'}。`,
      '强制回复顺序：先把最终文字答复完整输出一次，然后调用一次 `speak`；语音生成成功后立即结束本轮。',
      '调用 `speak` 之前不要再写第二份引用、摘要或同义正文；调用之后绝对不要重复正文。',
      '`speak` 的文本必须与已经输出的最终正文一致。语音消息会紧接在该正文之后：',
      '- `text` 使用自然口语，去掉 Markdown、链接、代码、表格和 emoji。',
      '- 长回答只朗读结论和关键信息，细节保留在文字里。',
      '- 不要再输出音频文件路径、Markdown 音频链接或“正在生成语音”之类的话。',
      '- 工具失败时保留文字答复，不向用户展示错误堆栈；最多重试一次。',
      '- 用户明确要求安静时不要调用。纯工具操作和极短确认可以不调用。',
    ].join('\n')
  }

  function dispose() {
    const child = runtime.child
    runtime.child = undefined
    if (child !== undefined) child.kill()
  }

  seed()

  return {
    get config() {
      return config
    },
    get latest() {
      return latest
    },
    applyWeights,
    dispose,
    ensure,
    liveServerState: async () => {
      const state = serverState()
      if (!state.running) state.running = await probe()
      return state
    },
    outDir,
    probe,
    promptText,
    refresh,
    snapshot,
    speak: synthesize,
    start,
    stop,
    storeDir,
    update,
  }
}

async function handle(service, ctx, request, response) {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname
  const method = request.method ?? 'GET'
  const rejection = rejectionStatus(ctx, request)
  if (rejection !== undefined) {
    response.writeHead(rejection)
    response.end()
    return
  }

  if (method === 'GET' && path === `${PREFIX}/state`) {
    sendJson(response, 200, await service.snapshot())
    return
  }
  if (method === 'GET' && path === `${PREFIX}/latest`) {
    sendJson(response, 200, { latest: service.latest, server: await service.liveServerState() })
    return
  }
  if (method === 'POST' && path === `${PREFIX}/refresh`) {
    sendJson(response, 200, await service.refresh())
    return
  }
  if (method === 'POST' && path === `${PREFIX}/config`) {
    try {
      const snapshot = await service.update(await readJson(request))
      let message = ''
      if (await service.probe()) {
        try {
          await service.applyWeights()
        } catch (error) {
          message = error instanceof Error ? error.message : String(error)
        }
      }
      sendJson(response, 200, { ...snapshot, message })
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  if (method === 'POST' && path === `${PREFIX}/server`) {
    try {
      const body = asRecord(await readJson(request))
      if (body?.action === 'stop') await service.stop()
      else await service.start()
      sendJson(response, 200, await service.snapshot())
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  if (method === 'POST' && path === `${PREFIX}/preview`) {
    try {
      const body = asRecord(await readJson(request))
      if (body?.config !== undefined) await service.update(body.config)
      const result = await service.speak(body?.text ?? '你好，语音设置已经准备好了。')
      sendJson(response, 200, result)
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  if ((method === 'GET' || method === 'HEAD') && path.startsWith(`${PREFIX}/audio/`)) {
    const file = decodeURIComponent(path.slice(`${PREFIX}/audio/`.length))
    if (!AUDIO_NAME.test(file)) {
      response.writeHead(404)
      response.end()
      return
    }
    let audio
    try {
      audio = readFileSync(join(service.outDir, file))
    } catch {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, {
      'cache-control': 'private, max-age=31536000, immutable',
      'content-length': audio.length,
      'content-type': 'audio/wav',
    })
    response.end(method === 'HEAD' ? undefined : audio)
    return
  }

  response.writeHead(404)
  response.end()
}

export function apply(ctx, config = {}) {
  const service = createVoiceService(ctx, asRecord(config) ?? {})

  ctx.effect(
    () => {
      const detach = ctx.webServer.register({
        kind: 'prefix',
        path: PREFIX,
        handler: (request, response) => {
          handle(service, ctx, request, response).catch((error) => {
            try {
              sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
            } catch {
              // The response may already be closed.
            }
          })
        },
      })
      return () => {
        detach()
        service.dispose()
      }
    },
    'dsh-voice: server routes and GPT-SoVITS process',
  )

  ctx.tools.register({
    name: 'speak',
    description:
      'Generate a GPT-SoVITS voice message for the reply. The UI inserts it as a playable voice bubble. Call this after writing the final answer once; after a successful result, end the turn without repeating that answer. Pass only natural spoken text, without Markdown, URLs, code, emoji, or tables.',
    parameters: {
      additionalProperties: false,
      properties: {
        text: {
          description: 'The exact natural-language words to speak.',
          type: 'string',
        },
      },
      required: ['text'],
      type: 'object',
    },
    output: {
      render: (_args, value) => {
        const blocks = [{ text: String(value.message ?? ''), type: 'text' }]
        if (typeof value.url === 'string' && value.url !== '') {
          const payload = Buffer.from(
            JSON.stringify({
              at: value.at,
              id: value.id,
              seconds: value.seconds,
              text: value.text,
              url: value.url,
              voice: value.voice,
            }),
          ).toString('base64url')
          blocks.push({ text: `\n<!--dsh-voice-audio:${payload}-->`, type: 'text' })
        }
        return blocks
      },
      schema: {
        additionalProperties: false,
        properties: {
          at: { type: 'number' },
          file: { type: 'string' },
          id: { type: 'string' },
          message: { type: 'string' },
          ok: { type: 'boolean' },
          seconds: { type: 'number' },
          text: { type: 'string' },
          url: { type: 'string' },
          voice: { type: 'string' },
        },
        required: ['ok', 'message'],
        type: 'object',
      },
    },
    timeoutMs: 330_000,
    isConcurrencySafe: () => false,
    async execute(args) {
      return service.speak(args.text)
    },
  })

  ctx.systemPrompt.section({
    name: 'tool:speak',
    order: 5000,
    text: () => service.promptText(),
  })
}
