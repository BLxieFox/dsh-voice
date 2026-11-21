window.__ModuleLoader__.load({
  id: '@local/dsh-voice',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const LOCALE = 'dsh-voice'

    const AUTO_PLAYED = new Set()

    const copy = {
      zh: {
        advanced: '连接与目录',
        auto: '自动识别',
        autoPlay: '自动播放',
        autoPlayHint: '语音生成后自动播放；浏览器拦截时仍可点击气泡播放',
        collapse: '收起语音面板',
        custom: '服务默认',
        dirty: '有未保存的更改',
        empty: '没有找到模型',
        errorLoad: '读取语音设置失败',
        expand: '打开语音设置',
        generating: '正在合成语音…',
        gpt: 'GPT 模型',
        heroA: 'LOCAL VOICE',
        heroB: 'GPT-SoVITS',
        hintGPT: '负责语义与韵律',
        hintRef: '建议使用 3–10 秒、背景干净的人声',
        hintSovits: '决定说话人的音色',
        labelPrompt: '参考文本',
        labelRef: '参考音频',
        labelSpeed: '语速',
        language: '朗读语言',
        modelSection: '模型与音色',
        noClip: '尚未生成语音',
        pause: '暂停语音',
        play: '播放语音',
        preview: '生成试听',
        previewing: '合成中…',
        previewPlaceholder: '输入一句试听文本',
        promptLanguage: '参考文本语言',
        promptPlaceholder: '参考音频中实际说出的文字，越准确音色越稳定',
        refresh: '刷新模型',
        refreshing: '刷新中…',
        replySection: '回复方式',
        save: '保存设置',
        saved: '设置已保存',
        server: '推理服务',
        serverError: '推理服务启动失败',
        settingsTitle: '语音回复',
        settingsSubtitle: '选择模型、音色和朗读方式。回复会以可播放的语音气泡显示在对话中。',
        speakingSection: '朗读参数',
        speakEvery: '每条回复都生成语音',
        speakEveryHint: '关闭后，只有你明确要求“念出来”时才生成',
        start: '启动',
        starting: '启动中',
        stop: '停止',
        transcript: '查看朗读文字',
        voiceCount: '个参考音频',
        advancedRoot: 'GPT-SoVITS 目录',
        advancedPython: 'Python 路径（留空使用内置运行时）',
        advancedPort: 'API 端口',
        langZh: '中文',
        langEn: 'English',
        langJa: '日本語',
        langKo: '한국어',
        langYue: '粤语',
      },
      en: {
        advanced: 'Connection and folders',
        auto: 'Auto detect',
        autoPlay: 'Autoplay',
        autoPlayHint: 'Play each generated clip; the bubble remains playable if autoplay is blocked',
        collapse: 'Close voice panel',
        custom: 'Server default',
        dirty: 'Unsaved changes',
        empty: 'No models found',
        errorLoad: 'Could not load voice settings',
        expand: 'Open voice settings',
        generating: 'Synthesizing voice…',
        gpt: 'GPT model',
        heroA: 'LOCAL VOICE',
        heroB: 'GPT-SoVITS',
        hintGPT: 'Controls language and prosody',
        hintRef: 'Use a clean 3–10 second speech sample',
        hintSovits: 'Defines the speaker timbre',
        labelPrompt: 'Reference transcript',
        labelRef: 'Reference audio',
        labelSpeed: 'Speed',
        language: 'Speech language',
        modelSection: 'Models and timbre',
        noClip: 'No voice generated yet',
        pause: 'Pause voice',
        play: 'Play voice',
        preview: 'Generate preview',
        previewing: 'Synthesizing…',
        previewPlaceholder: 'Enter preview text',
        promptLanguage: 'Transcript language',
        promptPlaceholder: 'The exact words in the reference audio',
        refresh: 'Refresh models',
        refreshing: 'Refreshing…',
        replySection: 'Reply behavior',
        save: 'Save settings',
        saved: 'Settings saved',
        server: 'Inference service',
        serverError: 'The inference service failed to start',
        settingsTitle: 'Voice replies',
        settingsSubtitle: 'Choose models and timbre. Replies appear as playable voice bubbles in the conversation.',
        speakingSection: 'Speech controls',
        speakEvery: 'Generate voice for every reply',
        speakEveryHint: 'When off, voice is generated only when you explicitly ask for it',
        start: 'Start',
        starting: 'Starting',
        stop: 'Stop',
        transcript: 'Show spoken text',
        voiceCount: 'reference clips',
        advancedRoot: 'GPT-SoVITS directory',
        advancedPython: 'Python path (blank uses bundled runtime)',
        advancedPort: 'API port',
        langZh: 'Chinese',
        langEn: 'English',
        langJa: 'Japanese',
        langKo: 'Korean',
        langYue: 'Cantonese',
      },
    }

    function text() {
      const language = `${document.documentElement?.lang || ''}${navigator.language || ''}`.toLowerCase()
      return language.startsWith('zh') ? copy.zh : copy.en
    }

    function basename(path) {
      const index = path.lastIndexOf('/')
      return index < 0 ? path : path.slice(index + 1)
    }

    function dirname(path) {
      const index = path.lastIndexOf('/')
      return index < 0 ? '' : path.slice(0, index)
    }

    function secondsLabel(value) {
      const seconds = Math.max(0, Number(value) || 0)
      if (!Number.isFinite(seconds)) return '0:00'
      const rounded = Math.round(seconds)
      return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
    }

    function decodeClip(payload) {
      try {
        const base = payload.replace(/-/g, '+').replace(/_/g, '/')
        const binary = atob(`${base}${'='.repeat((4 - (base.length % 4)) % 4)}`)
        const value = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0))))
        return value !== null && typeof value === 'object' && typeof value.url === 'string' ? value : undefined
      } catch {
        return undefined
      }
    }

    function clipFromBlock(block) {
      const content = block && Array.isArray(block.content) ? block.content : []
      for (const item of content) {
        if (!item || typeof item.text !== 'string') continue
        const match = /<!--dsh-voice-audio:([A-Za-z0-9_-]+)-->/.exec(item.text)
        if (match) {
          const clip = decodeClip(match[1])
          if (clip !== undefined) return clip
        }
      }
      return undefined
    }

    async function request(path, options = {}) {
      const response = await fetch(path, {
        cache: 'no-store',
        ...options,
        headers: {
          accept: 'application/json',
          ...(options.headers || {}),
        },
      })
      const raw = await response.text()
      let body
      if (raw !== '') {
        try {
          body = JSON.parse(raw)
        } catch {
          body = { error: raw.slice(0, 400) }
        }
      }
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      return body
    }

    function groupByDirectory(paths) {
      const groups = new Map()
      for (const path of paths || []) {
        const directory = dirname(path)
        if (!groups.has(directory)) groups.set(directory, [])
        groups.get(directory).push(path)
      }
      return [...groups.entries()]
    }

    function modelOptions(paths) {
      return groupByDirectory(paths).map(([directory, values]) =>
        h(
          'optgroup',
          { key: directory || '/', label: directory || '/' },
          values.map((path) =>
            h('option', { key: path, title: path, value: path }, basename(path)),
          ),
        ),
      )
    }

    function Icon(props) {
      const common = {
        'aria-hidden': true,
        fill: 'none',
        height: props.size || 18,
        viewBox: '0 0 24 24',
        width: props.size || 18,
      }
      if (props.kind === 'mic') {
        return h(
          'svg',
          common,
          h('rect', { x: 8.5, y: 3, width: 7, height: 12, rx: 3.5, fill: 'currentColor' }),
          h('path', {
            d: 'M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7V21M8.8 21h6.4',
            stroke: 'currentColor',
            strokeLinecap: 'round',
            strokeWidth: 1.8,
          }),
        )
      }
      if (props.kind === 'play') {
        return h(
          'svg',
          common,
          h('path', { d: 'M8 5.7v12.6L18.5 12 8 5.7Z', fill: 'currentColor' }),
        )
      }
      if (props.kind === 'pause') {
        return h(
          'svg',
          common,
          h('rect', { x: 7, y: 5.5, width: 3.5, height: 13, rx: 1.4, fill: 'currentColor' }),
          h('rect', { x: 13.5, y: 5.5, width: 3.5, height: 13, rx: 1.4, fill: 'currentColor' }),
        )
      }
      if (props.kind === 'refresh') {
        return h(
          'svg',
          common,
          h('path', {
            d: 'M19.2 8A8 8 0 1 0 20 14M19.2 8V3.8M19.2 8h-4.1',
            stroke: 'currentColor',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: 1.8,
          }),
        )
      }
      if (props.kind === 'spark') {
        return h(
          'svg',
          common,
          h('path', {
            d: 'M12 2.8c.8 5.3 3.1 7.6 8.4 8.4-5.3.8-7.6 3.1-8.4 8.4-.8-5.3-3.1-7.6-8.4-8.4 5.3-.8 7.6-3.1 8.4-8.4Z',
            fill: 'currentColor',
          }),
        )
      }
      if (props.kind === 'close') {
        return h(
          'svg',
          common,
          h('path', {
            d: 'm6.5 6.5 11 11m0-11-11 11',
            stroke: 'currentColor',
            strokeLinecap: 'round',
            strokeWidth: 1.8,
          }),
        )
      }
      return null
    }

    function Switch(props) {
      return h(
        'button',
        {
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label,
          className: `dshv2-switch${props.checked ? ' is-on' : ''}`,
          disabled: props.disabled,
          onClick: () => {
            if (!props.disabled) props.onChange(!props.checked)
          },
          role: 'switch',
          type: 'button',
        },
        h('span', { className: 'dshv2-switch-thumb' }),
      )
    }

    function SegmentedLanguage(props) {
      return h(
        'select',
        {
          className: 'dshv2-input',
          disabled: props.disabled,
          onChange: (event) => props.onChange(event.target.value),
          value: props.value,
        },
        props.options.map(([value, label]) => h('option', { key: value, value }, label)),
      )
    }

    function VoiceBubble(props) {
      const clip = props.clip
      const ui = text()
      const audioRef = React.useRef(null)
      const [playing, setPlaying] = React.useState(false)
      const [duration, setDuration] = React.useState(Number(clip.seconds) || 0)
      const [current, setCurrent] = React.useState(0)
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : Number(clip.seconds) || 0

      const bars = React.useMemo(() => {
        const seed = String(clip.id || clip.url)
          .split('')
          .reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 997, 17)
        return Array.from({ length: 20 }, (_, index) => 30 + ((seed + index * 37 + (index % 3) * 19) % 67))
      }, [clip.id, clip.url])

      const progress = safeDuration > 0 ? Math.min(1, current / safeDuration) : 0

      function toggle() {
        const audio = audioRef.current
        if (!audio) return
        if (audio.paused) {
          const started = audio.play()
          if (started && typeof started.catch === 'function') started.catch(() => setPlaying(false))
        } else {
          audio.pause()
        }
      }

      React.useEffect(() => {
        const audio = audioRef.current
        if (!audio || props.preview) return undefined
        const at = Number(clip.at || 0)
        if (Date.now() - at > 180_000 || AUTO_PLAYED.has(clip.id)) return undefined
        let cancelled = false
        let timer
        request('/.dsh-voice/state')
          .then((state) => {
            if (cancelled || state?.config?.autoPlay === false || AUTO_PLAYED.has(clip.id)) return
            AUTO_PLAYED.add(clip.id)
            timer = setTimeout(() => {
              const started = audio.play()
              if (started && typeof started.catch === 'function') started.catch(() => undefined)
            }, 260)
          })
          .catch(() => undefined)
        return () => {
          cancelled = true
          if (timer) clearTimeout(timer)
        }
      }, [clip.at, clip.id, props.preview])

      return h(
        'div',
        { className: `dshv2-voice-row${props.preview ? ' is-preview' : ''}` },
        h(
          'span',
          { className: 'dshv2-voice-avatar', title: clip.voice || '' },
          h(Icon, { kind: 'mic', size: 18 }),
        ),
        h(
          'div',
          { className: 'dshv2-voice-stack' },
          h(
            'button',
            {
              'aria-label': playing ? ui.pause : ui.play,
              className: 'dshv2-voice-bubble',
              onClick: toggle,
              style: { '--dshv-voice-seconds': Math.min(22, Math.max(3, safeDuration || 8)) },
              type: 'button',
            },
            h('span', { className: 'dshv2-voice-play' }, h(Icon, { kind: playing ? 'pause' : 'play', size: 16 })),
            h(
              'span',
              { className: 'dshv2-wave', 'aria-hidden': true },
              bars.map((height, index) =>
                h('i', {
                  key: index,
                  className: index / bars.length <= progress ? 'is-played' : '',
                  style: { height: `${height}%` },
                }),
              ),
            ),
            h('span', { className: 'dshv2-voice-time' }, secondsLabel(safeDuration)),
            h('span', { className: 'dshv2-voice-progress', style: { width: `${progress * 100}%` } }),
          ),
          clip.text
            ? h(
                'details',
                { className: 'dshv2-transcript' },
                h('summary', null, ui.transcript),
                h('p', null, clip.text),
              )
            : null,
        ),
        h('audio', {
          className: 'dshv2-hidden-audio',
          onDurationChange: (event) => {
            const value = Number(event.currentTarget.duration)
            setDuration(Number.isFinite(value) && value > 0 ? value : Number(clip.seconds) || 0)
          },
          onEnded: () => {
            setPlaying(false)
            setCurrent(0)
          },
          onPause: () => setPlaying(false),
          onPlay: () => setPlaying(true),
          onTimeUpdate: (event) => setCurrent(Number(event.currentTarget.currentTime) || 0),
          preload: props.preview ? 'auto' : 'metadata',
          ref: audioRef,
          src: clip.url,
        }),
      )
    }

    function clipFromToolBlock(root) {
      if (root === null || typeof root !== 'object') return undefined
      if (root.kind === 'tool-result' && (root.name === 'speak' || root.call?.name === 'speak')) {
        const clip = clipFromBlock(root)
        if (clip !== undefined) return clip
      }
      const children = Array.isArray(root.subCalls) ? root.subCalls : []
      for (const child of children) {
        const clip = clipFromToolBlock(child)
        if (clip !== undefined) return clip
      }
      return undefined
    }

    function VoiceTurnTail(props) {
      const encoded = props.useChat((chat) => {
        const keys = chat.locations.getTurn(props.turn.turn)
        let found
        for (const key of keys) {
          const node = chat.nodes.get(key)
          if (node?.kind !== 'tool-call') continue
          const clip = clipFromToolBlock(node.data?.root)
          if (clip !== undefined) found = clip
        }
        return found === undefined ? '' : JSON.stringify(found)
      })
      const data = React.useMemo(() => {
        if (encoded === '') return undefined
        try {
          const value = JSON.parse(encoded)
          return value !== null && typeof value === 'object' && typeof value.url === 'string' ? value : undefined
        } catch {
          return undefined
        }
      }, [encoded])
      const ref = React.useRef(null)

      React.useEffect(() => {
        const node = ref.current
        if (!node) return undefined
        const flow = node.closest('[data-slot="conversation.chat.flow"]')
        if (!flow) return undefined
        const marked = []
        const apply = () => {
          const rows = [...flow.querySelectorAll(
            `[data-chat-flow-kind="assistant-step"][data-chat-turn="${props.turn.turn}"]`,
          )]
          const messages = rows.map((row) => ({
            row,
            value: String(row.textContent || '').replace(/\s+/g, ' ').trim(),
          }))
          for (let earlier = 0; earlier < messages.length; earlier += 1) {
            if (messages[earlier].value === '') continue
            const repeated = messages.slice(earlier + 1).some((later) =>
              messages[earlier].value === later.value
                ? messages[earlier].value.length >= 6
                : messages[earlier].value.length >= 18 && later.value.startsWith(messages[earlier].value),
            )
            if (repeated) {
              messages[earlier].row.setAttribute('data-dshv-voice-dedupe', 'true')
              if (!marked.includes(messages[earlier].row)) marked.push(messages[earlier].row)
            }
          }
        }
        apply()
        const observer = new MutationObserver(apply)
        observer.observe(flow, { childList: true, subtree: true })
        return () => {
          observer.disconnect()
          for (const row of marked) row.removeAttribute('data-dshv-voice-dedupe')
        }
      }, [encoded, props.turn.turn])

      return data === undefined
        ? null
        : h('div', { className: 'dshv2-turn-voice', ref }, h(VoiceBubble, { clip: data }))
    }

    function VoicePanel(props) {
      const settingsMode = props.mode === 'settings'
      const ui = text()
      const [open, setOpen] = React.useState(true)
      const [snapshot, setSnapshot] = React.useState(undefined)
      const [draft, setDraft] = React.useState(undefined)
      const [busy, setBusy] = React.useState('')
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [previewText, setPreviewText] = React.useState('')
      const [previewClip, setPreviewClip] = React.useState(undefined)
      const [, rerender] = React.useState(0)

      React.useEffect(() => {
        if (typeof MutationObserver !== 'function' || !document.documentElement) return undefined
        const observer = new MutationObserver(() => rerender((value) => value + 1))
        observer.observe(document.documentElement, { attributeFilter: ['lang'] })
        return () => observer.disconnect()
      }, [])

      async function load() {
        try {
          const state = await request('/.dsh-voice/state')
          setSnapshot(state)
          setDraft({ ...state.config })
          if (previewText === '' && state.latest?.text) setPreviewText('你好，语音回复已经准备好了。')
          setError('')
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      }

      React.useEffect(() => {
        void load()
      }, [])

      React.useEffect(() => {
        if (!open) return undefined
        let stopped = false
        const timer = setInterval(() => {
          request('/.dsh-voice/latest')
            .then((value) => {
              if (stopped || !value?.server) return
              setSnapshot((previous) => (previous ? { ...previous, server: value.server } : previous))
            })
            .catch(() => undefined)
        }, 4_000)
        return () => {
          stopped = true
          clearInterval(timer)
        }
      }, [open])

      function toggleOpen() {
        const next = !open
        setOpen(next)
        try {
          window.localStorage.setItem(STORAGE_OPEN, next ? '1' : '0')
        } catch {
          // Local storage can be unavailable in restricted web views.
        }
      }

      function edit(field, value) {
        setDraft((previous) => ({ ...previous, [field]: value }))
        setNotice('')
      }

      function chooseReference(path) {
        setDraft((previous) => {
          const reference = (snapshot?.models?.refAudio || []).find((entry) => entry.path === path)
          const next = { ...previous, refAudio: path }
          if (reference?.text && !previous.promptText) next.promptText = reference.text
          return next
        })
        setNotice('')
      }

      async function saveDraft(showNotice = true) {
        const state = await request('/.dsh-voice/config', {
          body: JSON.stringify(draft),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })
        setSnapshot(state)
        setDraft({ ...state.config })
        if (showNotice) setNotice(state.message || ui.saved)
        return state
      }

      async function save() {
        if (!draft) return
        setBusy('save')
        setError('')
        setNotice('')
        try {
          await saveDraft(false)
          setNotice(ui.saved)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
          setBusy('')
        }
      }

      async function toggleServer() {
        const running = snapshot?.server?.running
        setBusy('server')
        setError('')
        setNotice('')
        try {
          const state = await request('/.dsh-voice/server', {
            body: JSON.stringify({ action: running ? 'stop' : 'start' }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          })
          setSnapshot(state)
          setDraft({ ...state.config })
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
          setBusy('')
        }
      }

      async function refreshModels() {
        setBusy('refresh')
        setError('')
        setNotice('')
        try {
          const state = await request('/.dsh-voice/refresh', {
            body: '{}',
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          })
          setSnapshot(state)
          setDraft((previous) => ({ ...previous, ...state.config }))
          setNotice(ui.saved)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
          setBusy('')
        }
      }

      async function preview() {
        if (!draft) return
        setBusy('preview')
        setError('')
        setNotice('')
        try {
          const result = await request('/.dsh-voice/preview', {
            body: JSON.stringify({
              config: draft,
              text: previewText || '你好，语音回复已经准备好了。',
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          })
          setPreviewClip(result)
          await load()
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        } finally {
          setBusy('')
        }
      }

      if (!snapshot || !draft) {
        return h(
          'div',
          { className: settingsMode ? 'dshv2-settings-root' : 'dshv2-floating-root' },
          h(
            'section',
            { className: 'dshv2-glass dshv2-loading-card', 'aria-busy': 'true' },
            h('span', { className: 'dshv2-loading-orb' }, h(Icon, { kind: 'spark', size: 22 })),
            h('strong', null, error || 'Loading…'),
          ),
        )
      }

      const models = snapshot.models || { gpt: [], refAudio: [], sovits: [] }
      const running = snapshot.server?.running === true
      const starting = snapshot.server?.starting === true
      const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot.config)
      const reference = (models.refAudio || []).find((entry) => entry.path === draft.refAudio)
      const languageOptions = [
        ['auto', ui.auto],
        ['zh', ui.langZh],
        ['en', ui.langEn],
        ['ja', ui.langJa],
        ['ko', ui.langKo],
        ['yue', ui.langYue],
      ]
      const promptLanguageOptions = languageOptions.slice(1)

      const hero = h(
        'header',
        { className: 'dshv2-hero' },
        h(
          'div',
          { className: 'dshv2-hero-copy' },
          h(
            'p',
            { className: 'dshv2-eyebrow' },
            h('span', { className: 'dshv2-eyebrow-dot' }),
            `${ui.heroA} / ${ui.heroB}`,
          ),
          h('h2', null, ui.settingsTitle),
          h('p', { className: 'dshv2-subtitle' }, ui.settingsSubtitle),
        ),
        settingsMode
          ? null
          : h(
              'button',
              {
                'aria-label': ui.collapse,
                className: 'dshv2-icon-button',
                onClick: toggleOpen,
                title: ui.collapse,
                type: 'button',
              },
              h(Icon, { kind: 'close', size: 18 }),
            ),
      )

      const serviceStrip = h(
        'div',
        { className: 'dshv2-service-strip' },
        h(
          'div',
          { className: 'dshv2-service-status' },
          h('span', { className: `dshv2-service-dot${running ? ' is-on' : starting ? ' is-waiting' : ''}` }),
          h(
            'span',
            null,
            h('small', null, ui.server),
            h('strong', null, starting ? ui.starting : running ? 'ONLINE' : 'OFFLINE'),
          ),
        ),
        h(
          'button',
          {
            className: 'dshv2-soft-button',
            disabled: busy !== '',
            onClick: toggleServer,
            type: 'button',
          },
          busy === 'server' ? ui.starting : running ? ui.stop : ui.start,
        ),
        h(
          'button',
          {
            'aria-label': ui.refresh,
            className: 'dshv2-icon-button is-soft',
            disabled: busy !== '',
            onClick: refreshModels,
            title: ui.refresh,
            type: 'button',
          },
          h(Icon, { kind: 'refresh', size: 17 }),
        ),
      )

      const modelCard = h(
        'section',
        { className: 'dshv2-section-card' },
        h(
          'div',
          { className: 'dshv2-section-head' },
          h('span', { className: 'dshv2-section-number' }, '01'),
          h('div', null, h('h3', null, ui.modelSection), h('p', null, `${models.gpt.length} GPT · ${models.sovits.length} SoVITS`)),
        ),
        h(
          'label',
          { className: 'dshv2-field' },
          h('span', { className: 'dshv2-label-row' }, h('span', null, ui.gpt), h('small', null, ui.hintGPT)),
          h(
            'select',
            {
              className: 'dshv2-input',
              disabled: busy !== '',
              onChange: (event) => edit('gpt', event.target.value),
              value: draft.gpt || '',
            },
            h('option', { value: '' }, `— ${ui.custom} —`),
            ...modelOptions(models.gpt),
          ),
        ),
        h(
          'label',
          { className: 'dshv2-field' },
          h('span', { className: 'dshv2-label-row' }, h('span', null, ui.sovits || 'SoVITS'), h('small', null, ui.hintSovits)),
          h(
            'select',
            {
              className: 'dshv2-input',
              disabled: busy !== '',
              onChange: (event) => edit('sovits', event.target.value),
              value: draft.sovits || '',
            },
            h('option', { value: '' }, `— ${ui.custom} —`),
            ...modelOptions(models.sovits),
          ),
        ),
      )

      const timbreCard = h(
        'section',
        { className: 'dshv2-section-card' },
        h(
          'div',
          { className: 'dshv2-section-head' },
          h('span', { className: 'dshv2-section-number' }, '02'),
          h(
            'div',
            null,
            h('h3', null, ui.labelRef),
            h('p', null, `${models.refAudio.length} ${ui.voiceCount}`),
          ),
        ),
        h(
          'label',
          { className: 'dshv2-field' },
          h('span', { className: 'dshv2-label-row' }, h('span', null, ui.labelRef), h('small', null, ui.hintRef)),
          h('input', {
            className: 'dshv2-input',
            disabled: busy !== '',
            list: 'dshv2-reference-audio',
            onChange: (event) => chooseReference(event.target.value),
            placeholder: 'dataset/myvoice/reference.wav',
            type: 'text',
            value: draft.refAudio || '',
          }),
          h(
            'datalist',
            { id: 'dshv2-reference-audio' },
            ...(models.refAudio || []).slice(0, 800).map((entry) =>
              h('option', { key: entry.path, label: entry.text, value: entry.path }),
            ),
          ),
        ),
        reference?.text
          ? h('p', { className: 'dshv2-reference-preview' }, reference.text)
          : null,
        h(
          'label',
          { className: 'dshv2-field' },
          h('span', { className: 'dshv2-label-row' }, h('span', null, ui.labelPrompt), h('small', null, ui.promptLanguage)),
          h('textarea', {
            className: 'dshv2-input dshv2-textarea',
            disabled: busy !== '',
            onChange: (event) => edit('promptText', event.target.value),
            placeholder: ui.promptPlaceholder,
            rows: 2,
            value: draft.promptText || '',
          }),
        ),
      )

      const speechCard = h(
        'section',
        { className: 'dshv2-section-card' },
        h(
          'div',
          { className: 'dshv2-section-head' },
          h('span', { className: 'dshv2-section-number' }, '03'),
          h('div', null, h('h3', null, ui.speakingSection), h('p', null, ui.replySection)),
        ),
        h(
          'div',
          { className: 'dshv2-field-grid' },
          h(
            'label',
            { className: 'dshv2-field' },
            h('span', null, ui.language),
            h(SegmentedLanguage, {
              disabled: busy !== '',
              onChange: (value) => edit('textLang', value),
              options: languageOptions,
              value: draft.textLang || 'auto',
            }),
          ),
          h(
            'label',
            { className: 'dshv2-field' },
            h('span', null, ui.promptLanguage),
            h(SegmentedLanguage, {
              disabled: busy !== '',
              onChange: (value) => edit('promptLang', value),
              options: promptLanguageOptions,
              value: draft.promptLang || 'zh',
            }),
          ),
        ),
        h(
          'label',
          { className: 'dshv2-range-row' },
          h('span', null, ui.labelSpeed),
          h('input', {
            disabled: busy !== '',
            max: 2,
            min: 0.5,
            onChange: (event) => edit('speed', Number(event.target.value)),
            step: 0.1,
            type: 'range',
            value: draft.speed ?? 1,
          }),
          h('output', null, `${Number(draft.speed || 1).toFixed(1)}×`),
        ),
        h(
          'div',
          { className: 'dshv2-toggle-card' },
          h('div', null, h('strong', null, ui.speakEvery), h('p', null, ui.speakEveryHint)),
          h(Switch, {
            checked: draft.speakEveryReply !== false,
            disabled: busy !== '',
            label: ui.speakEvery,
            onChange: (value) => edit('speakEveryReply', value),
          }),
        ),
        h(
          'div',
          { className: 'dshv2-toggle-card' },
          h('div', null, h('strong', null, ui.autoPlay), h('p', null, ui.autoPlayHint)),
          h(Switch, {
            checked: draft.autoPlay !== false,
            disabled: busy !== '',
            label: ui.autoPlay,
            onChange: (value) => edit('autoPlay', value),
          }),
        ),
      )

      const previewCard = h(
        'section',
        { className: 'dshv2-section-card dshv2-preview-card' },
        h(
          'div',
          { className: 'dshv2-section-head' },
          h('span', { className: 'dshv2-section-number' }, '04'),
          h('div', null, h('h3', null, ui.preview), h('p', null, basename(draft.sovits) || ui.custom)),
        ),
        h(
          'div',
          { className: 'dshv2-preview-controls' },
          h('input', {
            className: 'dshv2-input',
            disabled: busy !== '',
            onChange: (event) => setPreviewText(event.target.value),
            placeholder: ui.previewPlaceholder,
            type: 'text',
            value: previewText,
          }),
          h(
            'button',
            { className: 'dshv2-primary-button', disabled: busy !== '', onClick: preview, type: 'button' },
            busy === 'preview' ? ui.previewing : ui.preview,
          ),
        ),
        previewClip ? h(VoiceBubble, { clip: previewClip, preview: true }) : null,
      )

      const advanced = h(
        'details',
        { className: 'dshv2-advanced' },
        h('summary', null, ui.advanced),
        h(
          'label',
          { className: 'dshv2-field' },
          h('span', null, ui.advancedRoot),
          h('input', {
            className: 'dshv2-input',
            disabled: busy !== '',
            onChange: (event) => edit('root', event.target.value),
            type: 'text',
            value: draft.root || '',
          }),
        ),
        h(
          'div',
          { className: 'dshv2-field-grid' },
          h(
            'label',
            { className: 'dshv2-field' },
            h('span', null, ui.advancedPython),
            h('input', {
              className: 'dshv2-input',
              disabled: busy !== '',
              onChange: (event) => edit('python', event.target.value),
              placeholder: snapshot.paths?.python || 'python',
              type: 'text',
              value: draft.python || '',
            }),
          ),
          h(
            'label',
            { className: 'dshv2-field dshv2-port-field' },
            h('span', null, ui.advancedPort),
            h('input', {
              className: 'dshv2-input',
              disabled: busy !== '',
              max: 65535,
              min: 1024,
              onChange: (event) => edit('port', Number(event.target.value)),
              type: 'number',
              value: draft.port ?? 9880,
            }),
          ),
        ),
      )

      const footer = h(
        'footer',
        { className: 'dshv2-footer' },
        h(
          'div',
          { className: 'dshv2-footer-note' },
          dirty ? h('span', { className: 'dshv2-dirty-dot' }) : h('span', { className: 'dshv2-saved-dot' }),
          h('span', null, dirty ? ui.dirty : ui.saved),
        ),
        h(
          'button',
          {
            className: 'dshv2-primary-button is-wide',
            disabled: busy !== '' || !dirty,
            onClick: save,
            type: 'button',
          },
          busy === 'save' ? '…' : ui.save,
        ),
      )

      return h(
        'div',
        { className: settingsMode ? 'dshv2-settings-root' : 'dshv2-floating-root' },
        h(
          'section',
          { className: `dshv2-glass${settingsMode ? ' is-settings' : ' is-floating'}` },
          hero,
          serviceStrip,
          error ? h('p', { className: 'dshv2-alert is-error', role: 'alert' }, error) : null,
          notice ? h('p', { className: 'dshv2-alert is-success' }, notice) : null,
          h(
            'div',
            { className: 'dshv2-content' },
            modelCard,
            timbreCard,
            speechCard,
            previewCard,
            advanced,
          ),
          footer,
        ),
      )
    }

    const style = `
:root {
  --dshv2-accent: #75d7ff;
  --dshv2-accent-strong: #5e86ff;
  --dshv2-violet: #b780ff;
  --dshv2-ink: #f5f8ff;
}
* { box-sizing: border-box; }
.dshv2-settings-root { width: 100%; max-width: 860px; color: inherit; }
.dshv2-glass {
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, CanvasText 13%, Canvas);
  border-radius: 18px;
  background: Canvas;
  color: CanvasText;
  font-family: "Segoe UI Variable Display", "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif;
  font-size: 13px;
}
.dshv2-glass.is-settings {
  width: 100%;
  max-height: none;
  border-radius: 18px;
  background: Canvas;
}
.dshv2-hero { display: flex; align-items: flex-start; gap: 18px; justify-content: space-between; padding: 24px 24px 18px; }
.dshv2-floating-root .dshv2-hero { padding: 20px 20px 14px; }
.dshv2-hero-copy { min-width: 0; }
.dshv2-eyebrow { margin: 0 0 8px; display: flex; align-items: center; gap: 7px; color: rgba(214, 238, 255, .68); font-size: 9px; font-weight: 700; letter-spacing: .15em; }
.dshv2-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dshv2-accent); box-shadow: 0 0 13px rgba(117, 215, 255, .9); }
.dshv2-hero h2 { margin: 0; font-size: 26px; line-height: 1.08; letter-spacing: -.035em; font-weight: 680; color: #f7faff; }
.dshv2-floating-root .dshv2-hero h2 { font-size: 23px; }
.dshv2-subtitle { max-width: 650px; margin: 8px 0 0; color: rgba(227, 236, 253, .62); font-size: 12px; line-height: 1.55; }
.dshv2-icon-button, .dshv2-soft-button, .dshv2-primary-button { font: inherit; cursor: pointer; }
.dshv2-icon-button { width: 34px; height: 34px; display: grid; place-items: center; flex: none; border: 1px solid color-mix(in srgb, CanvasText 13%, Canvas); border-radius: 10px; background: color-mix(in srgb, CanvasText 6%, Canvas); color: CanvasText; transition: background .18s ease, opacity .18s ease; }
.dshv2-icon-button:hover:not(:disabled) { transform: translateY(-1px); background: rgba(255,255,255,.11); }
.dshv2-icon-button:disabled, .dshv2-soft-button:disabled, .dshv2-primary-button:disabled { opacity: .42; cursor: default; }
.dshv2-service-strip { margin: 14px 18px 12px; padding: 10px 11px 10px 14px; display: flex; align-items: center; gap: 8px; border: 1px solid color-mix(in srgb, CanvasText 11%, Canvas); border-radius: 12px; background: color-mix(in srgb, CanvasText 4%, Canvas); }
.dshv2-service-status { flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; }
.dshv2-service-status > span:last-child { display: flex; align-items: baseline; gap: 7px; min-width: 0; }
.dshv2-service-status small { color: rgba(230,239,255,.5); font-size: 10px; white-space: nowrap; }
.dshv2-service-status strong { color: rgba(241,247,255,.88); font-size: 10px; letter-spacing: .09em; }
.dshv2-service-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.24); flex: none; }
.dshv2-service-dot.is-on { background: #59e69a; box-shadow: 0 0 0 4px rgba(89,230,154,.11), 0 0 16px rgba(89,230,154,.55); }
.dshv2-service-dot.is-waiting { background: #ffcb66; animation: dshv2-breathe 1s ease-in-out infinite; }
.dshv2-soft-button { min-height: 30px; padding: 0 13px; border: 1px solid color-mix(in srgb, CanvasText 13%, Canvas); border-radius: 9px; background: color-mix(in srgb, CanvasText 6%, Canvas); color: CanvasText; font-size: 11px; transition: background .18s ease; }
.dshv2-soft-button:hover:not(:disabled) { background: rgba(255,255,255,.12); }
.dshv2-icon-button.is-soft { width: 30px; height: 30px; border-radius: 10px; }
.dshv2-content { display: flex; flex-direction: column; gap: 10px; padding: 2px 14px 14px; }
.dshv2-floating-root .dshv2-content { max-height: min(500px, calc(100vh - 330px)); overflow: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
.dshv2-section-card { padding: 15px; border: 1px solid color-mix(in srgb, CanvasText 10%, Canvas); border-radius: 12px; background: color-mix(in srgb, CanvasText 3.5%, Canvas); }
.dshv2-section-head { display: flex; gap: 11px; align-items: flex-start; margin-bottom: 13px; }
.dshv2-section-number { display: grid; place-items: center; width: 27px; height: 27px; flex: none; border-radius: 8px; background: color-mix(in srgb, #4f8cff 16%, Canvas); color: color-mix(in srgb, #4f8cff 80%, CanvasText); border: 1px solid color-mix(in srgb, #4f8cff 28%, Canvas); font-size: 9px; font-weight: 700; letter-spacing: .06em; }
.dshv2-section-head h3 { margin: 0; color: rgba(248,251,255,.94); font-size: 14px; line-height: 1.3; font-weight: 650; }
.dshv2-section-head p { margin: 2px 0 0; color: rgba(225,235,253,.48); font-size: 10px; line-height: 1.35; }
.dshv2-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; margin-top: 10px; color: rgba(235,242,255,.66); font-size: 10px; }
.dshv2-field:first-of-type { margin-top: 0; }
.dshv2-label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.dshv2-label-row small { color: rgba(219,231,251,.37); font-size: 9px; font-weight: 400; text-align: right; }
.dshv2-input { width: 100%; min-height: 38px; padding: 9px 11px; border: 1px solid color-mix(in srgb, CanvasText 13%, Canvas); border-radius: 9px; outline: none; background: color-mix(in srgb, CanvasText 4%, Canvas); color: CanvasText; font: inherit; font-size: 12px; transition: border-color .18s ease, background .18s ease, box-shadow .18s ease; }
.dshv2-input:hover { border-color: rgba(255,255,255,.21); }
.dshv2-input:focus { border-color: rgba(117,215,255,.64); background: rgba(4,10,24,.27); box-shadow: 0 0 0 3px rgba(92,174,255,.12); }
.dshv2-input option, .dshv2-input optgroup { color: CanvasText; background: Canvas; }
.dshv2-textarea { resize: vertical; min-height: 60px; line-height: 1.5; }
.dshv2-reference-preview { margin: 8px 0 0; padding: 9px 10px; border-left: 2px solid rgba(117,215,255,.5); border-radius: 4px 9px 9px 4px; background: rgba(4,10,24,.16); color: rgba(226,238,255,.58); font-size: 10px; line-height: 1.5; }
.dshv2-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; }
.dshv2-field-grid .dshv2-field { margin-top: 0; }
.dshv2-range-row { display: grid; grid-template-columns: auto 1fr 42px; align-items: center; gap: 11px; margin-top: 13px; color: rgba(235,242,255,.65); font-size: 10px; }
.dshv2-range-row input { width: 100%; accent-color: var(--dshv2-accent); }
.dshv2-range-row output { text-align: right; color: rgba(245,249,255,.86); font-variant-numeric: tabular-nums; }
.dshv2-toggle-card { margin-top: 10px; padding: 11px 12px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-radius: 14px; background: rgba(4,10,24,.14); }
.dshv2-toggle-card strong { display: block; color: rgba(247,250,255,.87); font-size: 11px; font-weight: 600; }
.dshv2-toggle-card p { margin: 2px 0 0; color: rgba(222,235,253,.42); font-size: 9px; line-height: 1.45; }
.dshv2-switch { position: relative; flex: none; width: 41px; height: 24px; padding: 0; border: 1px solid rgba(255,255,255,.1); border-radius: 999px; background: rgba(255,255,255,.12); cursor: pointer; transition: background .22s ease, box-shadow .22s ease; }
.dshv2-switch.is-on { background: #4f8cff; }
.dshv2-switch-thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: rgba(255,255,255,.96); box-shadow: 0 2px 5px rgba(0,0,0,.25); transition: transform .22s cubic-bezier(.2,.9,.24,1); }
.dshv2-switch.is-on .dshv2-switch-thumb { transform: translateX(17px); }
.dshv2-preview-controls { display: flex; gap: 8px; }
.dshv2-preview-controls .dshv2-input { flex: 1; }
.dshv2-primary-button { min-height: 38px; padding: 0 15px; border: 1px solid #4f8cff; border-radius: 9px; background: #4f8cff; color: white; font-size: 11px; font-weight: 650; transition: filter .18s ease; }
.dshv2-primary-button:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.07); }
.dshv2-primary-button.is-wide { min-width: 128px; }
.dshv2-advanced { border: 1px solid rgba(255,255,255,.07); border-radius: 16px; background: rgba(255,255,255,.025); color: rgba(226,237,255,.55); }
.dshv2-advanced summary { cursor: pointer; padding: 11px 13px; font-size: 10px; }
.dshv2-advanced[open] { padding-bottom: 13px; }
.dshv2-advanced > .dshv2-field, .dshv2-advanced > .dshv2-field-grid { margin-left: 13px; margin-right: 13px; }
.dshv2-advanced .dshv2-port-field { max-width: 150px; }
.dshv2-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px 16px; border-top: 1px solid color-mix(in srgb, CanvasText 9%, Canvas); background: Canvas; }
.dshv2-footer-note { display: flex; align-items: center; gap: 7px; color: rgba(229,239,255,.48); font-size: 10px; }
.dshv2-dirty-dot, .dshv2-saved-dot { width: 6px; height: 6px; border-radius: 50%; background: #ffcb66; box-shadow: 0 0 9px rgba(255,203,102,.45); }
.dshv2-saved-dot { background: #69e7a3; box-shadow: 0 0 9px rgba(105,231,163,.38); }
.dshv2-alert { margin: 0 18px 9px; padding: 9px 11px; border-radius: 11px; font-size: 10px; line-height: 1.45; white-space: pre-wrap; }
.dshv2-alert.is-error { border: 1px solid rgba(255,115,135,.24); background: rgba(255,82,111,.1); color: #ffc1cb; }
.dshv2-alert.is-success { border: 1px solid rgba(110,235,175,.2); background: rgba(76,220,146,.08); color: #aef4cf; }
.dshv2-loading-card { min-height: 170px; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 30px; color: rgba(244,248,255,.78); }
.dshv2-settings-root .dshv2-loading-card { width: 100%; }
.dshv2-loading-orb { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: color-mix(in srgb, #4f8cff 18%, Canvas); color: #7db4ff; }
.dshv2-voice-row { display: flex; align-items: flex-start; justify-content: flex-start; gap: 8px; padding: 8px 0 3px; font-family: "Segoe UI Variable Display", "Microsoft YaHei UI", system-ui, sans-serif; }
.dshv2-voice-row.is-preview { margin-top: 12px; justify-content: flex-start; }
.dshv2-voice-stack { min-width: 0; max-width: min(76%, 360px); display: flex; flex-direction: column; align-items: flex-start; }
.dshv2-voice-bubble { position: relative; overflow: hidden; width: clamp(178px, calc(132px + var(--dshv-voice-seconds, 8) * 8px), 308px); max-width: 100%; height: 44px; padding: 0 12px 0 7px; display: flex; align-items: center; gap: 9px; border: 0; border-radius: 4px 13px 13px 13px; background: #3f7df6; color: white; cursor: pointer; font: inherit; text-align: left; transition: background .16s ease; }
.dshv2-voice-bubble:hover { background: #4a88f8; }
.dshv2-voice-bubble:focus-visible { outline: 2px solid rgba(190,239,255,.9); outline-offset: 2px; }
.dshv2-voice-play { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.14); }
.dshv2-wave { height: 24px; flex: 1; display: flex; align-items: center; gap: 2px; min-width: 86px; }
.dshv2-wave i { width: 2px; min-height: 3px; border-radius: 2px; background: rgba(255,255,255,.44); transition: background .1s linear; }
.dshv2-wave i.is-played { background: rgba(255,255,255,.96); box-shadow: 0 0 5px rgba(255,255,255,.25); }
.dshv2-voice-time { min-width: 31px; text-align: right; font-size: 10px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.82); }
.dshv2-voice-progress { position: absolute; z-index: -1; left: 0; bottom: 0; height: 2px; background: rgba(255,255,255,.58); transition: width .12s linear; }
.dshv2-voice-avatar { width: 32px; height: 32px; margin-top: 6px; flex: none; display: grid; place-items: center; border: 1px solid color-mix(in srgb, #4f8cff 34%, Canvas); border-radius: 50%; background: color-mix(in srgb, #4f8cff 20%, Canvas); color: #7ab0ff; }
.dshv2-transcript { width: 100%; margin-top: 5px; color: rgba(219,230,249,.45); font-size: 9px; }
.dshv2-voice-row.is-preview .dshv2-transcript { color: rgba(225,235,253,.54); }
.dshv2-transcript summary { cursor: pointer; width: fit-content; margin-left: auto; }
.dshv2-voice-row.is-preview .dshv2-transcript summary { margin-left: 0; }
.dshv2-transcript p { margin: 5px 0 0; padding: 8px 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; background: rgba(4,10,24,.18); color: rgba(235,242,255,.64); font-size: 10px; line-height: 1.5; }
.dshv2-hidden-audio { display: none; }
.dshv2-inline-note { display: flex; align-items: center; gap: 8px; padding: 8px 0; color: rgba(225,235,253,.55); font-size: 11px; }
.dshv2-inline-note.is-generating { color: rgba(174,225,255,.78); }
.dshv2-mini-wave { height: 15px; display: flex; align-items: center; gap: 2px; }
.dshv2-mini-wave i { width: 2px; height: 7px; border-radius: 2px; background: currentColor; animation: dshv2-wave .9s ease-in-out infinite; }
.dshv2-mini-wave i:nth-child(2) { height: 13px; animation-delay: .12s; }
.dshv2-mini-wave i:nth-child(3) { height: 9px; animation-delay: .24s; }
.dshv2-mini-wave i:nth-child(4) { height: 5px; animation-delay: .36s; }
@keyframes dshv2-wave { 0%,100% { transform: scaleY(.55); opacity: .48; } 50% { transform: scaleY(1.15); opacity: 1; } }
@keyframes dshv2-breathe { 0%,100% { opacity: .55; transform: scale(.94); } 50% { opacity: 1; transform: scale(1.04); } }
@keyframes dshv2-arrive { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
@media (max-width: 620px) {
  .dshv2-floating-root { right: 14px; bottom: 74px; }
  .dshv2-field-grid { grid-template-columns: 1fr; }
  .dshv2-hero { padding: 20px 18px 14px; }
  .dshv2-content { padding-left: 10px; padding-right: 10px; }
  .dshv2-footer { padding-left: 14px; padding-right: 14px; }
  .dshv2-preview-controls { flex-direction: column; }
  .dshv2-label-row small { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dshv2-glass, .dshv2-service-dot, .dshv2-status-light, .dshv2-mini-wave i, .dshv2-loading-orb { animation: none !important; }
  .dshv2-voice-bubble, .dshv2-primary-button, .dshv2-icon-button, .dshv2-switch-thumb { transition: none !important; }
}
/* Final visual layer: flat, native DSH surfaces with no glass or blur. */
.dshv2-glass,
.dshv2-glass.is-settings {
  background: Canvas;
  color: CanvasText;
  border: 1px solid color-mix(in srgb, CanvasText 13%, Canvas);
  border-radius: 18px;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  animation: none;
}
.dshv2-glass::before,
.dshv2-glass::after,
.dshv2-ambient {
  display: none;
}
.dshv2-hero {
  padding: 22px 22px 15px;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 9%, Canvas);
}
.dshv2-hero h2 {
  color: CanvasText;
  font-size: 22px;
  letter-spacing: -.02em;
}
.dshv2-eyebrow {
  color: color-mix(in srgb, CanvasText 55%, Canvas);
  letter-spacing: .08em;
}
.dshv2-eyebrow-dot {
  background: #4f8cff;
  box-shadow: none;
}
.dshv2-subtitle {
  color: color-mix(in srgb, CanvasText 64%, Canvas);
}
.dshv2-icon-button,
.dshv2-soft-button {
  background: color-mix(in srgb, CanvasText 6%, Canvas);
  border-color: color-mix(in srgb, CanvasText 13%, Canvas);
  color: CanvasText;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.dshv2-icon-button:hover:not(:disabled),
.dshv2-soft-button:hover:not(:disabled) {
  background: color-mix(in srgb, CanvasText 10%, Canvas);
}
.dshv2-service-strip {
  margin-top: 14px;
  background: color-mix(in srgb, CanvasText 4%, Canvas);
  border-color: color-mix(in srgb, CanvasText 11%, Canvas);
  box-shadow: none;
}
.dshv2-service-status small,
.dshv2-service-status strong {
  color: color-mix(in srgb, CanvasText 72%, Canvas);
}
.dshv2-content {
  gap: 12px;
  padding: 14px 16px 16px;
}
.dshv2-section-card {
  padding: 15px;
  border-color: color-mix(in srgb, CanvasText 10%, Canvas);
  border-radius: 14px;
  background: color-mix(in srgb, CanvasText 3.5%, Canvas);
  box-shadow: none;
}
.dshv2-section-number {
  width: 27px;
  height: 27px;
  border-radius: 8px;
  background: color-mix(in srgb, #4f8cff 16%, Canvas);
  border-color: color-mix(in srgb, #4f8cff 28%, Canvas);
  color: color-mix(in srgb, #4f8cff 80%, CanvasText);
}
.dshv2-section-head h3 {
  color: CanvasText;
  font-size: 13px;
}
.dshv2-section-head p,
.dshv2-label-row small,
.dshv2-field,
.dshv2-toggle-card p,
.dshv2-footer-note {
  color: color-mix(in srgb, CanvasText 55%, Canvas);
}
.dshv2-input {
  background: color-mix(in srgb, CanvasText 4%, Canvas);
  border-color: color-mix(in srgb, CanvasText 13%, Canvas);
  color: CanvasText;
  box-shadow: none;
}
.dshv2-input:focus {
  border-color: #4f8cff;
  background: color-mix(in srgb, CanvasText 5%, Canvas);
  box-shadow: 0 0 0 2px color-mix(in srgb, #4f8cff 20%, transparent);
}
.dshv2-reference-preview,
.dshv2-toggle-card,
.dshv2-advanced {
  background: color-mix(in srgb, CanvasText 3%, Canvas);
}
.dshv2-reference-preview {
  border-left-color: #4f8cff;
  color: color-mix(in srgb, CanvasText 64%, Canvas);
}
.dshv2-toggle-card strong,
.dshv2-range-row output {
  color: CanvasText;
}
.dshv2-range-row {
  color: color-mix(in srgb, CanvasText 62%, Canvas);
}
.dshv2-range-row input {
  accent-color: #4f8cff;
}
.dshv2-switch {
  background: color-mix(in srgb, CanvasText 17%, Canvas);
  border-color: color-mix(in srgb, CanvasText 11%, Canvas);
}
.dshv2-switch.is-on {
  background: #4f8cff;
  box-shadow: none;
}
.dshv2-primary-button {
  background: #4f8cff;
  border-color: #4f8cff;
  box-shadow: none;
}
.dshv2-primary-button:hover:not(:disabled) {
  filter: brightness(1.08);
}
.dshv2-footer {
  padding: 14px 18px 16px;
  background: Canvas;
  border-color: color-mix(in srgb, CanvasText 9%, Canvas);
}
.dshv2-alert.is-error {
  background: color-mix(in srgb, #ff5c75 9%, Canvas);
  border-color: color-mix(in srgb, #ff5c75 30%, Canvas);
  color: color-mix(in srgb, #ff5c75 78%, CanvasText);
}
.dshv2-alert.is-success {
  background: color-mix(in srgb, #36c77f 9%, Canvas);
  border-color: color-mix(in srgb, #36c77f 26%, Canvas);
  color: color-mix(in srgb, #36c77f 72%, CanvasText);
}
.dshv2-voice-row,
.dshv2-voice-row.is-preview {
  justify-content: flex-start;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0 3px;
}
.dshv2-turn-voice { margin: 10px 0 6px; }
[data-dshv-voice-dedupe="true"] { display: none !important; }
.dshv2-voice-stack,
.dshv2-voice-row.is-preview .dshv2-voice-stack {
  align-items: flex-start;
  max-width: min(76%, 360px);
}
.dshv2-voice-bubble,
.dshv2-voice-row.is-preview .dshv2-voice-bubble {
  width: clamp(178px, calc(132px + var(--dshv-voice-seconds, 8) * 8px), 308px);
  min-width: 0;
  height: 44px;
  padding: 0 12px 0 7px;
  border: 0;
  border-radius: 4px 13px 13px 13px;
  background: #3f7df6;
  box-shadow: none;
}
.dshv2-voice-bubble:hover {
  background: #4a88f8;
}
.dshv2-voice-play {
  width: 30px;
  height: 30px;
  background: color-mix(in srgb, white 14%, transparent);
  box-shadow: none;
}
.dshv2-wave {
  min-width: 62px;
  height: 22px;
}
.dshv2-voice-time {
  min-width: 29px;
  font-size: 9px;
}
.dshv2-voice-progress {
  height: 1px;
  background: rgba(255,255,255,.72);
}
.dshv2-voice-avatar {
  width: 32px;
  height: 32px;
  margin-top: 6px;
  background: color-mix(in srgb, #4f8cff 20%, Canvas);
  border-color: color-mix(in srgb, #4f8cff 34%, Canvas);
  color: #7ab0ff;
  box-shadow: none;
}
.dshv2-transcript,
.dshv2-voice-row.is-preview .dshv2-transcript {
  margin-top: 4px;
  color: color-mix(in srgb, CanvasText 45%, Canvas);
}
.dshv2-transcript summary,
.dshv2-voice-row.is-preview .dshv2-transcript summary {
  margin-left: 0;
}
.dshv2-transcript p {
  background: color-mix(in srgb, CanvasText 3%, Canvas);
  border-color: color-mix(in srgb, CanvasText 9%, Canvas);
  color: color-mix(in srgb, CanvasText 64%, Canvas);
}
.dshv2-inline-note {
  color: color-mix(in srgb, CanvasText 55%, Canvas);
}
@media (max-width: 620px) {
  .dshv2-hero { padding: 18px 16px 13px; }
  .dshv2-content { padding: 12px; }
  .dshv2-voice-stack,
  .dshv2-voice-row.is-preview .dshv2-voice-stack { max-width: calc(100% - 46px); }
}
`

    const inject = ['locale', 'slots']

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(LOCALE, {
          en: { play: 'Play', label: 'Voice reply' },
          zh: { play: '播放', label: '语音回复' },
        }),
        'dsh-voice: locale',
      )

      ctx.effect(
        () => {
          const node = document.createElement('style')
          node.id = 'dsh-voice-v2-style'
          node.textContent = style
          document.head.append(node)
          return () => node.remove()
        },
        'dsh-voice: native flat styles',
      )

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            id: 'voice',
            name: 'settings.section',
            locale: LOCALE,
            order: 27,
            label: () => text().settingsTitle,
            inject: () => ({}),
          },
          () => h(VoicePanel, { mode: 'settings' }),
        ),
      )

      ctx.slots.inject('conversation.chat.turnTail', () =>
        ctx.slots.register(
          { id: 'dsh-voice', locale: LOCALE, name: 'conversation.chat.turnTail', order: 40 },
          VoiceTurnTail,
        ),
      )
    }

    return { inject, apply }
  },
})
