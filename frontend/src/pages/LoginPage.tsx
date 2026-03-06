import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import './AuthPages.css'

interface LoginResponse {
  success: boolean
  data: {
    user: {
      id: string
      email: string
    }
    auth: {
      token: string
      expiresIn: string
    }
  }
  message?: string
}

interface ApiError {
  response?: {
    data?: {
      message?: string
      errors?: Record<string, string[]>
    }
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, setLoading, isLoading } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  // Get the redirect path from location state, default to home
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      })

      if (response.data.success) {
        const { user, auth } = response.data.data
        login(user, auth.token)
        navigate(from, { replace: true })
      }
    } catch (err: unknown) {
      const apiError = err as ApiError
      if (apiError.response?.data?.errors) {
        setFieldErrors(apiError.response.data.errors)
      } else if (apiError.response?.data?.message) {
        setError(apiError.response.data.message)
      } else {
        setError('登录失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>登录</h1>
          <p>欢迎回来！请登录您的账户</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">邮箱</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="请输入邮箱地址"
              required
              autoComplete="email"
              disabled={isLoading}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email[0]}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password[0]}</span>}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            还没有账户？ <Link to="/register">立即注册</Link>
          </p>
        </div>

        <div className="auth-guest-hint">
          <p>
            <Link to="/">以访客身份浏览</Link>（部分功能受限）
          </p>
        </div>
      </div>
    </div>
  )
}
