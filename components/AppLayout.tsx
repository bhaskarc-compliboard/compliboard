'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  didYouKnow?: { icon: string; text: string }
}

const NAV_ITEMS = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '🛡️', label: 'Audits', href: '/audits', soon: true },
  { icon: '📋', label: 'Compliance Workspace', href: '/compliance' },
  { icon: '👥', label: 'HR Workspace', href: '/hr' },
  { icon: '📁', label: 'Company Documents', href: '/documents' },
  { icon: '📅', label: 'Calendar', href: '/calendar' },
  { icon: '📚', label: 'Requirements', href: '/requirements' },
  { icon: '⚙️', label: 'My Account', href: '/account', soon: false },
]

export default function AppLayout({ children, title, didYouKnow }: AppLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function loadCompany() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (profile?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profile.company_id)
          .single()
        if (company) setCompanyName(company.name)
      }
    }
    loadCompany()
  }, [])

  useEffect(() => {
    if (title) document.title = `${title} — CompliBoard`
    else document.title = 'CompliBoard'
  }, [title])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function sendFeedback() {
    if (!feedbackMessage.trim()) return
    setFeedbackLoading(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: feedbackMessage }),
      })
      setFeedbackSent(true)
      setFeedbackMessage('')
      setTimeout(() => {
        setShowFeedback(false)
        setFeedbackSent(false)
      }, 2000)
    } catch (error) {
      console.error(error)
    } finally {
      setFeedbackLoading(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText('https://compliboard.com')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareEmail() {
    const subject = encodeURIComponent('You need to see this compliance tool')
    const body = encodeURIComponent('Hi, I have been using CompliBoard for compliance questions. Worth checking out: https://compliboard.com')
    window.open('mailto:?subject=' + subject + '&body=' + body)
  }

  function shareLinkedIn() {
    const url = encodeURIComponent('https://compliboard.com')
    window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + url, '_blank')
  }

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => {
                if (!item.soon) {
                  router.push(item.href)
                  setSidebarOpen(false)
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-green-50 text-green-800 font-medium'
                  : item.soon
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
              }`}>
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.soon && (
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400">
                  Soon
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        {companyName && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-gray-400 mb-0.5">Logged in as</p>
            <p className="text-sm font-semibold text-green-700 truncate">{companyName}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">
          <span>🚪</span>
          <span>Log out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <a href="/dashboard" className="hidden lg:flex items-center gap-2 pl-3">
            <span className="text-base font-semibold"><span className="text-green-700">Compli</span><span className="text-orange-600">Board</span></span>
          </a>
          {title && (
            <span className="text-sm text-gray-400 hidden sm:block">/ {title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowReferral(true); setShowFeedback(false) }}
            className="text-sm text-gray-500 hover:text-green-700 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-50 hidden sm:flex items-center gap-1.5">
            <span>🔗</span>
            <span>Refer a friend</span>
          </button>
          <button
            onClick={() => { setShowFeedback(true); setShowReferral(false) }}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors flex items-center gap-1.5">
            <span>💬</span>
            <span>Feedback</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">

        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-200 sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarContent />
        </aside>

        {/* Sidebar — mobile overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black bg-opacity-30" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-64 bg-white shadow-xl">
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1">
            {children}
          </div>

          {/* Did you know */}
          {didYouKnow && (
            <div className="px-6 py-8 border-t border-gray-100 mt-8">
              <div className="max-w-4xl mx-auto flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{didYouKnow.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Did you know?</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{didYouKnow.text}</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="border-t border-gray-100 px-6 py-4 bg-white">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
                <a href="mailto:hello@compliboard.com" className="hover:text-gray-600 transition-colors">Contact</a>
              </div>
              <p className="text-xs text-gray-400">© 2026 CompliBoard LLC</p>
            </div>
          </footer>
        </main>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <span className="text-green-400">✓</span>
          {toast}
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFeedback(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Send us feedback</h3>
              <button onClick={() => setShowFeedback(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            {feedbackSent ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-medium text-gray-900">Thank you for your feedback</p>
                <p className="text-xs text-gray-500 mt-1">We read every message</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Tell us what is working, what is not, or what you wish CompliBoard did.
                </p>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-gray-50"
                  rows={5}
                  placeholder="Your message..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={sendFeedback}
                    disabled={feedbackLoading || !feedbackMessage.trim()}
                    className="flex-1 bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                    {feedbackLoading ? 'Sending...' : 'Send feedback'}
                  </button>
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:border-gray-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {showReferral && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowReferral(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Refer a friend</h3>
              <button onClick={() => setShowReferral(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Know someone who struggles with compliance? Share CompliBoard with them.
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 mb-4">
              <span className="text-sm text-gray-600 flex-1">compliboard.com</span>
              <button onClick={copyLink}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors whitespace-nowrap">
                {copied ? '✓ Copied' : '📋 Copy link'}
              </button>
            </div>
            <div className="space-y-2">
              <button onClick={shareEmail}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-green-500 hover:text-green-700 hover:bg-green-50 transition-colors">
                <span className="text-lg">📧</span>
                <div className="text-left">
                  <p className="font-medium">Send via email</p>
                  <p className="text-xs text-gray-400">Opens your email with a message ready to send</p>
                </div>
              </button>
              <button onClick={shareLinkedIn}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                <span className="text-lg">🔗</span>
                <div className="text-left">
                  <p className="font-medium">Share on LinkedIn</p>
                  <p className="text-xs text-gray-400">Share with your professional network</p>
                </div>
              </button>
            </div>
            <button onClick={() => setShowReferral(false)}
              className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export { AppLayout }
export type { AppLayoutProps }
