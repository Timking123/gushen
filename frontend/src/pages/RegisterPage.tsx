import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import './AuthPages.css'

interface RegisterResponse {
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

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login, setLoading, isLoading } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const validateForm = (): boolean => {
    const errors: Record<string, string[]> = {}

    if (!email) {
      errors.email = ['请输入邮箱地址']
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = ['请输入有效的邮箱地址']
    }

    if (!password) {
      errors.password = ['请输入密码']
    } else if (password.length < 8) {
      errors.password = ['密码至少需要8个字符']
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = ['密码必须包含大写字母、小写字母和数字']
    }

    if (!confirmPassword) {
      errors.confirmPassword = ['请确认密码']
    } else if (password !== confirmPassword) {
      errors.confirmPassword = ['两次输入的密码不一致']
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await api.post<RegisterResponse>('/auth/register', {
        email,
        password,
      })

      if (response.data.success) {
        const { user, auth } = response.data.data
        login(user, auth.token)
        navigate('/', { replace: true })
      }
    } catch (err: unknown) {
      const apiError = err as ApiError
      if (apiError.response?.data?.errors) {
        setFieldErrors(apiError.response.data.errors)
      } else if (apiError.response?.data?.message) {
        setError(apiError.response.data.message)
      } else {
        setError('注册失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>注册</h1>
          <p>创建账户以解锁完整功能</p>
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
              placeholder="至少8个字符，包含大小写字母和数字"
              required
              autoComplete="new-password"
              disabled={isLoading}
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password[0]}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">确认密码</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              required
              autoComplete="new-password"
              disabled={isLoading}
            />
            {fieldErrors.confirmPassword && (
              <span className="field-error">{fieldErrors.confirmPassword[0]}</span>
            )}
          </div>

          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            已有账户？ <Link to="/login">立即登录</Link>
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
