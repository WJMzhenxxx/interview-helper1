import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer';
/**
 * API配置接口
 * @property apiProvider - API提供商名称
 * @property apiKey - API密钥
 * @property baseUrl - API基础URL
 * @property seq - 配置序号
 * @property model - 使用的模型名称（可选）
 * @property maxTokens - 最大token数（可选）
 * @property temperature - 温度参数（可选）
 * @property description - 配置描述（可选）
 * @property createdAt - 创建时间
 * @property updatedAt - 更新时间
 */
export interface ApiConfig {
  apiProvider: string
  apiKey: string
  baseUrl: string
  seq: number
  model?: string
  maxTokens?: number
  temperature?: number
  isDefault?: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

/**
 * API配置状态接口
 * @property apiConfigs - API配置列表
 * @property addConfig - 添加新配置的方法
 * @property updateConfig - 更新配置的方法
 * @property deleteConfig - 删除配置的方法
 */
interface ApiConfigState {
  apiConfigs: ApiConfig[]
  addConfig: (config: Omit<ApiConfig, 'createdAt' | 'updatedAt'>) => void
  updateConfig: (seq: number, config: Partial<ApiConfig>) => void
  deleteConfig: (seq: number) => void
  setDefaultConfig: (seq: number) => void
}

// 默认的DeepSeek配置
const defaultDeepSeekConfig: Omit<ApiConfig, 'createdAt' | 'updatedAt'> = {
  apiProvider: 'deepseek',
  apiKey: '', // 需要用户在设置中配置
  baseUrl: 'https://api.deepseek.com',
  seq: 1,
  model: 'deepseek-chat',
  maxTokens: 2000,
  temperature: 0.7,
  description: 'DeepSeek API 默认配置（请在设置中填入您的API密钥）'
}

export const useApiConfigStore = create<ApiConfigState>()(
  devtools(
    persist(
      immer((set) => ({
        apiConfigs: [{
          ...defaultDeepSeekConfig,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
        addConfig: (config) => set((state) => {
          state.apiConfigs.push({
            ...config,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }),
        updateConfig: (seq, config) => set((state) => {
          state.apiConfigs = state.apiConfigs.map((item) =>
            item.seq === seq
              ? {
                  ...item,
                  ...config,
                  updatedAt: new Date().toISOString(),
                }
              : item
          )
        }),
        deleteConfig: (seq) => set((state) => {
          state.apiConfigs = state.apiConfigs.filter((item) => item.seq !== seq)
        }),
        setDefaultConfig: (seq) => set((state) => {
          state.apiConfigs = state.apiConfigs.map((item) => ({
            ...item,
            isDefault: item.seq === seq,
          }))
        }),
      })),
      {
        name: 'api-config-storage',
      }
    ),
    {
      name: 'api-config-store',
      trace: true,
      traceLimit: 25,
    }
  )
) 