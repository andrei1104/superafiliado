'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { USERS } from './lib/auth'

export default function Login() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleLogin() {
    setLoading(true)
    setError('')
    const user = USERS[login.toLowerCase().trim()]
    if (!user || user.password !== password) {
      setError('Login ou senha incorretos.')
      setLoading(false)
      return
    }
    // Salva sessão simples no sessionStorage
    sessionStorage.setItem('amplify_user', JSON.stringify({ login: login.toLowerCase().trim(), ...user }))
    if (user.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0D1B8E', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Inter',sans-serif", padding:'1rem' }}>

      {/* Logo */}
      <div style={{ marginBottom:'2.5rem', textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', justifyContent:'center', marginBottom:'8px' }}>
          <div style={{ background:'#E4003A', borderRadius:'10px', width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10L10 4L16 10L10 16L4 10Z" fill="white"/>
            </svg>
          </div>
          <span style={{ color:'white', fontWeight:800, fontSize:'1.5rem', letterSpacing:'-0.02em' }}>Amplify</span>
        </div>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'13px', fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>
          Super Afiliado · Portal
        </div>
      </div>

      {/* Card */}
      <div style={{ background:'white', borderRadius:'20px', padding:'2rem', width:'100%', maxWidth:'380px', boxShadow:'0 24px 64px rgba(0,0,0,0.3)' }}>
        <h1 style={{ fontSize:'1.25rem', fontWeight:800, color:'#0D0D1A', marginBottom:'4px', letterSpacing:'-0.02em' }}>Entrar</h1>
        <p style={{ fontSize:'13px', color:'#9CA3AF', marginBottom:'1.5rem', fontWeight:500 }}>Acesse seu painel de performance</p>

        <label style={{ fontSize:'11px', fontWeight:700, color:'#6B6B8A', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>Login</label>
        <input
          value={login}
          onChange={e => setLogin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="seu login"
          autoComplete="username"
          style={{ width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1.5px solid #E5E7EB', fontSize:'14px', fontFamily:'inherit', outline:'none', marginBottom:'1rem', boxSizing:'border-box',
            transition:'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = '#1B3FE4'}
          onBlur={e => e.target.style.borderColor = '#E5E7EB'}
        />

        <label style={{ fontSize:'11px', fontWeight:700, color:'#6B6B8A', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>Senha</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="••••••"
          autoComplete="current-password"
          style={{ width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1.5px solid #E5E7EB', fontSize:'14px', fontFamily:'inherit', outline:'none', marginBottom:'1.5rem', boxSizing:'border-box' }}
          onFocus={e => e.target.style.borderColor = '#1B3FE4'}
          onBlur={e => e.target.style.borderColor = '#E5E7EB'}
        />

        {error && (
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#DC2626', marginBottom:'1rem', fontWeight:600 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || !login || !password}
          style={{ width:'100%', padding:'13px', background: login && password ? '#1B3FE4' : '#E5E7EB', color: login && password ? 'white' : '#9CA3AF',
            border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:700, cursor: login && password ? 'pointer' : 'not-allowed',
            transition:'all 0.2s', fontFamily:'inherit', letterSpacing:'0.02em' }}>
          {loading ? 'Entrando...' : 'Entrar →'}
        </button>
      </div>

      <div style={{ marginTop:'2rem', color:'rgba(255,255,255,0.3)', fontSize:'11px' }}>
        Amplify UGC · Programa Super Afiliado
      </div>
    </div>
  )
}
