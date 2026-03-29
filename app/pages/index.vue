<script setup lang="ts">
const clients = [
  { label: 'Clash', value: 'clash' },
  { label: 'sing-box', value: 'singbox' },
  { label: 'V2Ray', value: 'v2ray' },
  { label: 'Surge 4', value: 'surge&ver=4' },
  { label: 'Surge 3', value: 'surge&ver=3' },
  { label: 'Quantumult X', value: 'quanx' },
  { label: 'Loon', value: 'loon' },
  { label: 'Surfboard', value: 'surfboard' },
  { label: 'Shadowsocks', value: 'ss' },
  { label: 'ShadowsocksR', value: 'ssr' },
  { label: 'Mixed', value: 'mixed' },
]

const NONE_CONFIG = 'none'
const configPresets = [
  { label: '不使用远程配置', value: NONE_CONFIG },
  { label: 'ACL4SSR 默认版', value: 'ACL4SSR_Online' },
  { label: 'ACL4SSR 全分组', value: 'ACL4SSR_Online_Full' },
  { label: 'ACL4SSR 精简版', value: 'ACL4SSR_Online_Mini' },
  { label: 'ACL4SSR 无自动测速', value: 'ACL4SSR_Online_NoAuto' },
  { label: 'ACL4SSR 全分组无测速', value: 'ACL4SSR_Online_Full_NoAuto' },
  { label: 'ACL4SSR 精简无测速', value: 'ACL4SSR_Online_Mini_NoAuto' },
  { label: 'ACL4SSR 去广告Plus', value: 'ACL4SSR_Online_AdblockPlus' },
  { label: 'ACL4SSR 全分组去广告Plus', value: 'ACL4SSR_Online_Full_AdblockPlus' },
  { label: 'ACL4SSR 全分组多模式', value: 'ACL4SSR_Online_Full_MultiMode' },
  { label: 'ACL4SSR 精简多模式', value: 'ACL4SSR_Online_Mini_MultiMode' },
  { label: 'ACL4SSR 多国家', value: 'ACL4SSR_Online_MultiCountry' },
  { label: 'ACL4SSR 精简多国家', value: 'ACL4SSR_Online_Mini_MultiCountry' },
  { label: 'ACL4SSR 无拦截', value: 'ACL4SSR_Online_NoReject' },
  { label: 'ACL4SSR 全分组奈飞', value: 'ACL4SSR_Online_Full_Netflix' },
  { label: 'ACL4SSR 全分组谷歌', value: 'ACL4SSR_Online_Full_Google' },
  { label: 'ACL4SSR 精简Fallback', value: 'ACL4SSR_Online_Mini_Fallback' },
]

const modeTabs = [
  { label: '基础模式', value: 'basic' },
  { label: '进阶模式', value: 'advanced' },
]

// State
const sourceUrls = ref('')
const clientType = ref('clash')
const mode = ref('basic')
const defaultConfig = 'ACL4SSR_Online'
const remoteConfig = ref(defaultConfig)
const backendUrl = ref('')
const includeRemarks = ref('')
const excludeRemarks = ref('')
const filename = ref('')
const emoji = ref(true)
const udp = ref(false)
const tfo = ref(false)
const scv = ref(false)
const sort = ref(false)
const appendType = ref(false)
const list = ref(false)

// Output
const resultUrl = ref('')
const copied = ref(false)
const toast = useToast()

const currentOrigin = computed(() => {
  if (import.meta.client) return window.location.origin
  return ''
})

const isAdvanced = computed(() => mode.value === 'advanced')

function generateUrl() {
  const urls = sourceUrls.value
    .split('\n')
    .map(u => u.trim())
    .filter(Boolean)
    .join('|')

  if (!urls) {
    toast.add({ title: '请输入订阅链接', color: 'warning' })
    return
  }

  const backend = backendUrl.value || currentOrigin.value
  const [target, ...extraParams] = clientType.value.split('&')

  const params = new URLSearchParams()
  params.set('target', target)
  params.set('url', urls)

  for (const p of extraParams) {
    const idx = p.indexOf('=')
    if (idx > 0) params.set(p.slice(0, idx), p.slice(idx + 1))
  }

  if (remoteConfig.value && remoteConfig.value !== NONE_CONFIG) params.set('config', remoteConfig.value)
  if (includeRemarks.value) params.set('include', includeRemarks.value)
  if (excludeRemarks.value) params.set('exclude', excludeRemarks.value)
  if (filename.value) params.set('filename', filename.value)

  params.set('emoji', String(emoji.value))
  params.set('list', String(list.value))
  params.set('udp', String(udp.value))
  params.set('tfo', String(tfo.value))
  params.set('scv', String(scv.value))
  params.set('sort', String(sort.value))
  params.set('append_type', String(appendType.value))

  resultUrl.value = `${backend}/api/sub?${params.toString()}`
}

async function copyUrl() {
  if (!resultUrl.value) return
  try {
    await navigator.clipboard.writeText(resultUrl.value)
    copied.value = true
    toast.add({ title: '已复制到剪贴板', color: 'success' })
    setTimeout(() => { copied.value = false }, 2000)
  }
  catch {
    toast.add({ title: '复制失败', color: 'error' })
  }
}

function importToClash() {
  if (!resultUrl.value) return
  window.open(`clash://install-config?url=${encodeURIComponent(resultUrl.value)}`)
}

function reset() {
  sourceUrls.value = ''
  resultUrl.value = ''
  clientType.value = 'clash'
  remoteConfig.value = defaultConfig
  includeRemarks.value = ''
  excludeRemarks.value = ''
  filename.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-[var(--ui-bg-muted)]">
    <!-- Header -->
    <div class="pt-10 pb-6 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-[var(--ui-text-highlighted)]">
        Sub Converter
      </h1>
      <p class="mt-2 text-sm text-[var(--ui-text-muted)]">
        订阅转换工具 — Clash / V2Ray / Surge / QuantumultX / sing-box
      </p>
    </div>

    <!-- Main Card -->
    <div class="mx-auto max-w-2xl px-4 pb-12">
      <UCard>
        <!-- Mode Tabs -->
        <UTabs v-model="mode" :items="modeTabs" class="mb-6" />

        <!-- Subscription URLs -->
        <UFormField label="订阅链接" class="mb-4">
          <UTextarea
            v-model="sourceUrls"
            :rows="3"
            autoresize
            placeholder="输入订阅链接，每行一个"
          />
        </UFormField>

        <!-- Client + Config in a row -->
        <div class="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
          <UFormField label="客户端">
            <USelect v-model="clientType" :items="clients" />
          </UFormField>

          <UFormField label="远程配置">
            <USelect v-model="remoteConfig" :items="configPresets" />
          </UFormField>
        </div>

        <!-- Advanced -->
        <template v-if="isAdvanced">
          <USeparator class="my-5" />

          <UFormField label="后端地址" class="mb-4">
            <UInput v-model="backendUrl" placeholder="留空使用当前站点" />
          </UFormField>

          <UFormField label="自定义远程配置 URL" class="mb-4">
            <UInput v-model="remoteConfig" placeholder="覆盖上方下拉选择" />
          </UFormField>

          <div class="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
            <UFormField label="包含节点">
              <UInput v-model="includeRemarks" placeholder="正则" />
            </UFormField>
            <UFormField label="排除节点">
              <UInput v-model="excludeRemarks" placeholder="正则" />
            </UFormField>
          </div>

          <UFormField label="输出文件名" class="mb-5">
            <UInput v-model="filename" placeholder="可选" />
          </UFormField>

          <div class="flex flex-wrap gap-x-6 gap-y-3 mb-5">
            <UCheckbox v-model="emoji" label="Emoji" />
            <UCheckbox v-model="udp" label="UDP" />
            <UCheckbox v-model="tfo" label="TFO" />
            <UCheckbox v-model="scv" label="跳过证书验证" />
            <UCheckbox v-model="sort" label="排序节点" />
            <UCheckbox v-model="appendType" label="类型标注" />
            <UCheckbox v-model="list" label="仅节点列表" />
          </div>
        </template>

        <!-- Actions -->
        <div class="flex gap-3 mt-6">
          <UButton color="primary" @click="generateUrl">
            生成订阅链接
          </UButton>
          <UButton color="neutral" variant="outline" @click="reset">
            重置
          </UButton>
        </div>

        <!-- Result -->
        <template v-if="resultUrl">
          <USeparator class="my-5" />

          <UFormField label="转换结果">
            <div class="flex gap-2">
              <UInput
                :model-value="resultUrl"
                readonly
                class="flex-1 font-mono text-xs"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <UButton
                :color="copied ? 'success' : 'neutral'"
                variant="outline"
                @click="copyUrl"
              >
                {{ copied ? '已复制' : '复制' }}
              </UButton>
            </div>
          </UFormField>

          <div class="flex gap-2 mt-3">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-import"
              @click="importToClash"
            >
              导入 Clash
            </UButton>
            <UButton
              :to="resultUrl"
              target="_blank"
              color="neutral"
              variant="soft"
              icon="i-lucide-external-link"
            >
              浏览器打开
            </UButton>
          </div>
        </template>
      </UCard>

      <!-- Footer -->
      <p class="mt-6 text-center text-xs text-[var(--ui-text-dimmed)]">
        Powered by Nuxt &mdash; 基于
        <a
          href="https://github.com/tindy2013/subconverter"
          target="_blank"
          class="underline underline-offset-2 hover:text-[var(--ui-text-muted)]"
        >subconverter</a>
        转换逻辑
      </p>
    </div>
  </div>
</template>
