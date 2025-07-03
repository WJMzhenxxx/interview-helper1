import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

/**
 * 科大讯飞API配置接口
 */
export interface XfyunConfig {
  appId: string
  apiKey: string
  isConfigured: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

interface XfyunConfigState {
  config: XfyunConfig
  updateConfig: (appId: string, apiKey: string) => void
  clearConfig: () => void
  getAppId: () => string
  getApiKey: () => string
}

const defaultConfig: XfyunConfig = {
  appId: '',
  apiKey: '',
  isConfigured: false,
  description: '科大讯飞语音转写API配置',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

export const useXfyunConfigStore = create<XfyunConfigState>()(
  devtools(
    persist(
      immer((set, get) => ({
        config: defaultConfig,
        
        updateConfig: (appId: string, apiKey: string) => {
          set((state) => {
            state.config.appId = appId
            state.config.apiKey = apiKey
            state.config.isConfigured = !!(appId && apiKey)
            state.config.updatedAt = new Date().toISOString()
          })
        },
        
        clearConfig: () => {
          set((state) => {
            state.config = {
              ...defaultConfig,
              createdAt: state.config.createdAt,
              updatedAt: new Date().toISOString()
            }
          })
        },
        
        getAppId: () => {
          const { config } = get()
          return config.appId || import.meta.env.VITE_XFYUN_APPID || ''
        },
        
        getApiKey: () => {
          const { config } = get()
          return config.apiKey || import.meta.env.VITE_XFYUN_API_KEY || ''
        }
      })),
      {
        name: 'xfyun-config-storage',
      }
    ),
    {
      name: 'xfyun-config-store',
      trace: true,
      traceLimit: 25,
    }
  )
)