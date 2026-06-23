'use client'

import { useState, useEffect } from 'react'
import HomepageSection from '@/components/HomepageSection'

export default function HomePage() {

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-semibold tracking-tight">
            <span className="text-green-700">Compli</span><span className="text-orange-600">Board</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign in</a>
            <a href="/signup" className="bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-800 transition-colors">
              Start free trial →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-20 px-6" style={{background: "linear-gradient(to right, #dcfce7 0%, #ffffff 50%, #f0fdf4 100%)"}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">
              Your compliance assistant for small and medium businesses.
            </h1>
            <p className="text-base text-gray-500 mb-6 max-w-lg leading-relaxed">
              CompliBoard helps you manage compliance requirements, documents, HR policies, and deadlines — all in one place.
            </p>
            <div className="flex items-center gap-4">
              <a href="/signup" className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                Start your free trial →
              </a>
              <p className="text-xs text-gray-400">14 days free · No credit card needed</p>
            </div>
          </div>
          <img
            src="/Hero2.png"
            alt="CompliBoard product — compliance checklist, document audit, calendar and HR help"
            className="w-full h-auto rounded-2xl shadow-xl"
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl font-bold text-gray-900">From a question to a <span className="text-green-700">compliance action plan</span> in minutes.</h2>
          </div>
          <img
            src="/How_it_works_6.png"
            alt="How CompliBoard works — ask a question, get requirements, expand into steps, review checklist"
            className="w-full h-auto px-0 -mb-8"
          />
        </div>
      </section>

      {/* DOCUMENT REVIEW */}
      <section className="py-16 px-6" style={{background: '#FFFBF0'}}>
        <div className="max-w-6xl mx-auto">
          <img
            src="/Audit_report_4.png"
            alt="CompliBoard Document Review — upload documents, audit folder, get compliance gap report"
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* COMPLIANCE CALENDAR */}
      <HomepageSection
        title="Compliance Calendar"
        background="#F0F9FF"
        steps={[
          { label: "Upload a document or add manually", description: "Any permit, license, or compliance document with a deadline." },
          { label: "Dates extracted automatically", description: "CompliBoard reads your document and pulls every renewal and expiry date." },
          { label: "Added to your calendar", description: "Every deadline appears on your compliance calendar automatically." },
          { label: "Get alerted before every deadline", description: "Monthly summaries and alerts before anything expires or comes due." },
        ]}
        headline="Never miss a renewal."
        headlineGreen="Never pay a late fee."
        description="CompliBoard extracts compliance deadlines from your documents automatically and adds them to your calendar. Get alerted before anything expires."
        bullets={[
          "Automatic date extraction from any document",
          "Overdue and upcoming deadline alerts",
          "Add to Google Calendar or Outlook in one click",
          "Recurring deadline tracking for annual renewals",
        ]}
        ctaText="Start your free trial →"
        ctaHref="/signup"
      >
        {/* Calendar mock */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="grid grid-cols-2 gap-3 p-4 border-b border-gray-100">
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700">⚠️ Overdue</p>
              <p className="text-xs text-red-600">3 deadlines past due</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-700">📅 Due in 30 days</p>
              <p className="text-xs text-amber-600">2 deadlines coming up</p>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">←</span>
              <p className="text-xs font-semibold text-gray-900">July 2026</p>
              <span className="text-xs text-gray-400">→</span>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <p key={d} className="text-center text-xs text-gray-400 py-1">{d}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {[null,null,1,2,3,4,5].map((day, i) => (
                <div key={i} className="h-10 flex flex-col items-center pt-1">
                  {day && <p className="text-xs text-gray-600">{day}</p>}
                </div>
              ))}
              {[6,7,8,9,10,11,12].map((day) => (
                <div key={day} className="h-10 flex flex-col items-center pt-1">
                  <p className="text-xs text-gray-600 mb-0.5">{day}</p>
                  {day === 8 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">ISO 9001...</p>}
                </div>
              ))}
              {[13,14,15,16,17,18,19].map((day) => (
                <div key={day} className="h-10 flex flex-col items-center pt-1">
                  <p className="text-xs text-gray-600 mb-0.5">{day}</p>
                  {day === 15 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">OSHA PSM...</p>}
                </div>
              ))}
              {[20,21,22,23,24,25,26].map((day) => (
                <div key={day} className="h-10 flex flex-col items-center pt-1">
                  <p className="text-xs text-gray-600 mb-0.5">{day}</p>
                  {day === 20 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">DEQ Air...</p>}
                  {day === 22 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">DOT Haz...</p>}
                </div>
              ))}
              {[27,28,29,30,31,null,null].map((day, i) => (
                <div key={i} className="h-10 flex flex-col items-center pt-1">
                  {day && <p className="text-xs text-gray-600 mb-0.5">{day}</p>}
                  {day === 31 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">EPA RMP...</p>}
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This month</p>
              <div className="space-y-1.5">
                {[
                  { name: "ISO 9001:2015 Surveillance Audit", days: "Due in 23 days" },
                  { name: "OSHA Process Safety Management Review", days: "Due in 30 days" },
                  { name: "Oregon DEQ Air Quality Permit Renewal", days: "Due in 35 days" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded border-2 border-gray-300 flex-shrink-0" />
                    <p className="text-xs text-gray-700 flex-1 truncate">{item.name}</p>
                    <span className="text-xs text-amber-600 flex-shrink-0">{item.days}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </HomepageSection>

      {/* HR POLICY ASSISTANT */}
      <HomepageSection
        title="HR Policy Assistant"
        background="#F7FEF9"
        steps={[
          { label: "Upload your handbook", description: "Your existing employee handbook — any format." },
          { label: "Ask any HR question", description: "Parental leave, sick days, termination process — anything." },
          { label: "Get the answer, gaps, and a draft policy", description: "Know what your handbook says, what's missing, and get a draft fix." },
          { label: "Audit your handbook", description: "Run a full audit against current regulations and close every gap." },
        ]}
        headline="Get answers from"
        headlineGreen="your own handbook."
        description="Upload your employee handbook and ask any HR question. CompliBoard tells you what your policy says, flags what's missing, and drafts the language to fix it."
        bullets={[
          "Answers grounded in your actual handbook",
          "Policy gap detection against federal and state law",
          "Draft policy language ready to implement",
          "Full handbook audit in one click",
        ]}
        ctaText="Start your free trial →"
        ctaHref="/signup"
      >
        {/* HR mock */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Ask a question</p>
            <p className="text-xs text-gray-800 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-3">An employee just told me he needs 12 weeks off to care for an ill parent. What does our handbook say about this and what are we required to provide under FMLA?</p>
            <div className="mt-3">
              <span className="bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg inline-block">Get answer from handbook →</span>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="border-l-4 border-gray-300 pl-3 py-1">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Answer from your handbook</p>
              <p className="text-xs text-gray-700 leading-relaxed">According to your handbook (Section 7.1), your company offers up to 8 weeks of unpaid leave per calendar year for qualifying family and medical reasons.</p>
              <p className="text-xs text-gray-400 leading-relaxed filter blur-[2px] select-none mt-1">However, your handbook explicitly states that federal FMLA does not apply to your company because you have 42 employees.</p>
            </div>
            <div className="border-l-4 border-amber-500 pl-3 py-1">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">⚠️ Policy gaps detected</p>
              <div className="space-y-1">
                {[
                  "No policy covering care for parents or other family members",
                  "No guidance on leave requests that exceed the 8-week maximum",
                  "No state-specific family leave considerations",
                ].map((gap, i) => (
                  <p key={i} className="text-xs text-gray-400 filter blur-[2px] select-none">• {gap}</p>
                ))}
              </div>
            </div>
            <div className="border-l-4 border-green-500 pl-3 py-1">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">📝 Draft policy suggestion</p>
              <p className="text-xs text-gray-400 leading-relaxed filter blur-[2px] select-none">Extended Family Care Leave: Employees may request unpaid leave to care for a parent, grandparent, sibling, or other immediate family member with a serious health condition.</p>
              <p className="text-xs text-green-600 mt-1.5">↓ Download draft policy</p>
            </div>
          </div>
        </div>
      </HomepageSection>

      {/* WORKSPACE + PRICING */}
      <section className="py-24 px-6 bg-green-700">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-3xl font-bold text-white">Your Complete Compliance Workspace</p>
            <p className="text-green-100 mt-3 text-sm">Everything your business needs to stay compliant — in one place.</p>
          </div>
          <div className="grid grid-cols-2 gap-12 items-stretch">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="mb-6">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-2xl text-gray-300 line-through font-medium">$49</span>
                  <span className="text-xs text-gray-400 mb-1">/month</span>
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-6xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-400 mb-2">/month</span>
                </div>
                <p className="text-xs text-green-700 font-medium">Early adopter price — locked forever</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited compliance checklists with micro-steps",
                  "Document storage, audit and gap analysis",
                  "Deadline tracking and calendar alerts",
                  "HR handbook questions and policy drafts",
                  "Monthly regulation change summaries",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500 flex-shrink-0">✓</span>{feature}
                  </li>
                ))}
              </ul>
              <a href="/signup" className="block w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors text-center mb-3">
                Start your 14-day free trial →
              </a>
              <p className="text-xs text-gray-400 text-center">No credit card needed · Cancel anytime</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col justify-center">
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { icon: '📋', title: 'Compliance Checklist', desc: 'Ask anything about regulations and get a step-by-step checklist' },
                  { icon: '👥', title: 'HR Help', desc: 'Get answers to HR and policy questions from your company handbook' },
                  { icon: '📁', title: 'Company Documents', desc: 'Upload, view and manage your compliance documents and checklists' },
                ].map((module, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-3xl mb-3">{module.icon}</p>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{module.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{module.desc}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: '📅', title: 'Calendar', desc: 'Track all your compliance deadlines and recurring dates' },
                  { icon: '⚙️', title: 'My Account', desc: 'Manage your profile, billing, and account settings' },
                ].map((module, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-3xl mb-3">{module.icon}</p>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{module.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{module.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <p className="text-sm font-semibold">
            <span className="text-green-700">Compli</span><span className="text-orange-600">Board</span>
          </p>
          <div className="flex items-center gap-6">
            <a href="/login" className="text-xs text-gray-400 hover:text-gray-600">Sign in</a>
            <a href="/signup" className="text-xs text-gray-400 hover:text-gray-600">Create account</a>
          </div>
          <p className="text-xs text-gray-400">© 2026 CompliBoard. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
