import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type AxiosError,
  CancelToken,
} from 'axios'

/**
 * Timeout configuration for different request types (Requirement 8.1, 8.3)
 */
export const TIMEOUT_CONFIG = {
  default: 30000, // 30 seconds
  upload: 60000, // 60 seconds for file uploads
  longRunning: 120000, // 2 minutes for complex queries
  quick: 10000, // 10 seconds for quick operations
} as const

/**
 * Retry configuration (Requirement 8.5)
 */
const RETRY_CONFIG = {
  maxRetries: 2,
  retryDelay: 1000, // 1 second
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

/**
 * Active request cancellation tokens (Requirement 8.4)
 */
const pendingRequests = new Map<string, AbortController>()

/**
 * Generate a unique key for a request
 */
function getRequestKey(config: InternalAxiosRequestConfig): string {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`
}

/**
 * Cancel a pending request by key
 */
export function cancelRequest(key: string): void {
  const controller = pendingRequests.get(key)
  if (controller) {
    controller.abort()
    pendingRequests.delete(key)
  }
}

/**
 * Cancel all pending requests
 */
export function cancelAllRequests(): void {
  pendingRequests.forEach((controller) => controller.abort())
  pendingRequests.clear()
}

// Create axios instance with default config (Requirement 8.1)
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: TIMEOUT_CONFIG.default,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth token and request cancellation
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add auth token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Setup request cancellation (Requirement 8.4)
    const requestKey = getRequestKey(config)

    // Cancel previous identical request if exists
    cancelRequest(requestKey)

    // Create new AbortController for this request
    const controller = new AbortController()
    config.signal = controller.signal
    pendingRequests.set(requestKey, controller)

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors and cleanup
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Remove from pending requests on success
    const requestKey = getRequestKey(response.config as InternalAxiosRequestConfig)
    pendingRequests.delete(requestKey)
    return response
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number }

    // Remove from pending requests
    if (config) {
      const requestKey = getRequestKey(config)
      pendingRequests.delete(requestKey)
    }

    // Handle timeout errors with friendly message (Requirement 8.2)
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Request timeout:', config?.url)
      return Promise.reject({
        ...error,
        message: '请求超时，请检查网络连接后重试',
        isTimeout: true,
      })
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        ...error,
        message: '网络连接失败，请检查网络设置',
        isNetworkError: true,
      })
    }

    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Retry logic for retryable errors (Requirement 8.5)
    if (config && shouldRetry(error)) {
      config._retryCount = config._retryCount || 0

      if (config._retryCount < RETRY_CONFIG.maxRetries) {
        config._retryCount += 1
        console.log(`Retrying request (${config._retryCount}/${RETRY_CONFIG.maxRetries}):`, config.url)

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.retryDelay * config._retryCount))

        return api.request(config)
      }
    }

    return Promise.reject(error)
  }
)

/**
 * Check if an error should trigger a retry (Requirement 8.5)
 */
function shouldRetry(error: AxiosError): boolean {
  if (!error.response) return false
  return RETRY_CONFIG.retryableStatuses.includes(error.response.status)
}

export default api
