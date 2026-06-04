'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'

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
  },
  {
    icon: '👥',
    title: 'HR Help',
    description: 'Get answers to HR and policy questions from your company handbook',
    href: '/hr',
    soon: true,
  },
  {
    icon: '📁',
    title: 'My Files',
    description: 'Upload, view and manage your compliance documents and checklists',
    href: '/documents',
  },
  {
    icon: '📅',
    title: 'Calendar',
    description: 'Track all your compliance deadlines and recurring dates',
    href: '/calendar',
  },
  {
    icon: '⚙️',
    title: 'My Account',
    description: 'Manage your profile, billing, and account settings',
    href: '/account',
    soon: true,
  },
]

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
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Dashboard">
      <div className="p-6 max-w-5xl mx-auto">

        <div className="mb-8">
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 shadow-sm">
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
              onClick={() => !module.soon && router.push(module.href)}
              className={`group bg-white rounded-xl border border-gray-200 p-6 shadow-sm transition-all ${
                module.soon
                  ? 'opacity-50 cursor-default'
                  : 'cursor-pointer hover:border-green-400 hover:shadow-md'
              }`}>
              <div className="text-3xl mb-3">{module.icon}</div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-gray-900">{module.title}</h2>
                {module.soon && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                    Soon
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{module.description}</p>
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  )
}
