'use client'

import { useState } from 'react'
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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
    const body = encodeURIComponent(`Hi,

I have been using CompliBoard to handle compliance questions for our facility and it has saved me hours.

You ask a question in plain English and it gives you a complete checklist with sources in under a minute.

Worth checking out: https://compliboard.com`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  function shareLinkedIn() {
    const url = encodeURIComponent('https://compliboard.com')
    const summary = encodeURIComponent('Just started using CompliBoard for compliance questions — it gives you a complete checklist with sources instantly.')
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${summary}`, '_blank')
  }

  return (
    <html lang="en">
      <head>
        <title>CompliBoard</title>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>

        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-green-800">CompliBoard</span>
            <span className="text-xs text-gray-400 hidden sm:block">— Compliance made simple</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowReferral(true); setShowFeedback(false) }}
              className="text-sm text-gray-500 hover:text-green-700 transition-colors flex items-center gap-1.5">
              <span>🔗</span>
              <span className="hidden sm:block">Refer a friend</span>
            </button>
            <button
              onClick={() => { setShowFeedback(true); setShowReferral(false) }}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors flex items-center gap-1.5">
              <span>💬</span>
              <span>Feedback</span>
            </button>
          </div>
        </header>

        {children}

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
                <button
                  onClick={copyLink}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors whitespace-nowrap">
                  {copied ? '✓ Copied' : '📋 Copy link'}
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={shareEmail}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-green-500 hover:text-green-700 hover:bg-green-50 transition-colors">
                  <span className="text-lg">📧</span>
                  <div className="text-left">
                    <p className="font-medium">Send via email</p>
                    <p className="text-xs text-gray-400">Opens your email with a message ready to send</p>
                  </div>
                </button>
                <button
                  onClick={shareLinkedIn}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                  <span className="text-lg">🔗</span>
                  <div className="text-left">
                    <p className="font-medium">Share on LinkedIn</p>
                    <p className="text-xs text-gray-400">Share with your professional network</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowReferral(false)}
                className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Close
              </button>
            </div>
          </div>
        )}

      </body>
    </html>
  )
}
