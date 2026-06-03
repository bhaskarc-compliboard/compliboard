'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface CompanyProfile {
  name: string
  industry?: string
  state?: string
  city?: string
}

const MODULES = [
  {
    icon: '📋',
    title: 'Compliance Checklist',
    description: 'Ask anything about regulations and get a step-by-step checklist',
    href: '/compliance',
    color: 'green',
  },
  {
    icon: '👥',
    title: 'HR Help',
    description: 'Get answers to HR and policy questions from your company handbook',
    href: '/hr',
    color: 'blue',
    comingSoon: true,
  },
  {
    icon: '📁',
    title: 'My Files',
    description: 'View and manage your uploaded compliance documents',
    href: '/documents',
    color: 'purple',
    comingSoon: true,
  },
  {
    icon: '📅',
    title: 'Calendar',
    description: 'Track all your compliance deadlines and recurring dates',
    href: '/calendar',
    color: 'orange',
    comingSoon: true,
  },
  {
    icon: '📤',
    title: 'Upload',
    description: 'Add files, reports, or your existing compliance schedule',
    href: '/upload',
    color: 'teal',
    comingSoon: true,
  },
  {
    icon: '⚙️',
    title: 'My Account',
    description: 'Manage your profile, billing, and account settings',
    href: '/account',
    color: 'gray',
    comingSoon: true,
  },
]

const colorMap: Record<string, string> = {
  green: 'hover:border-green-400 hover:bg-green-50 group-hover:text-green-700',
  blue: 'hover:border-blue-400 hover:bg-blue-50 group-hover:text-blue-700',
  purple: 'hover:border-purple-400 hover:bg-purple-50 group-hover:text-purple-700',
  orange: 'hover:border-orange-400 hover:bg-orange-50 group-hover:text-orange-700',
  teal: 'hover:border-teal-400 hover:bg-teal-50 group-hover:text-teal-700',
  gray: 'hover:border-gray-400 hover:bg-gray-50 group-hover:text-gray-700',
}

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (profileData?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name, industry, state, city')
          .eq('id', profileData.company_id)
          .single()
        if (company) setProfile(company)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Welcome back</p>
            <h1 className="text-xl font-semibold text-gray-900">{profile?.name}</h1>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {profile?.industry && <span className="text-sm text-gray-500">{profile.industry}</span>}
              {profile?.industry && profile?.state && <span className="text-gray-300">·</span>}
              {profile?.state && <span className="text-sm text-gray-500">{profile.state}</span>}
              {profile?.state && profile?.city && <span className="text-gray-300">·</span>}
              {profile?.city && <span className="text-sm text-gray-500">{profile.city}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((module) => (
            <div
              key={module.href}
              onClick={() => !module.comingSoon && router.push(module.href)}
              className={`group bg-white rounded-2xl border border-gray-200 p-6 shadow-sm transition-all ${
                module.comingSoon
                  ? 'opacity-60 cursor-default'
                  : `cursor-pointer ${colorMap[module.color]}`
              }`}>
              <div className="text-3xl mb-3">{module.icon}</div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-base font-semibold text-gray-900">{module.title}</h2>
                {module.comingSoon && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                    Soon
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{module.description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          CompliBoard — Compliance made simple
        </p>

      </div>
    </main>
  )
}
