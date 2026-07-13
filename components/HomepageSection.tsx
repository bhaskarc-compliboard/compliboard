import React from 'react'

interface Step {
  label: string
  description: string
}

interface HomepageSectionProps {
  title: string
  background: string
  steps?: Step[]
  headline: string
  headlineGreen?: string
  description: string
  bullets: string[]
  ctaText?: string
  ctaHref?: string
  image?: string
  imageAlt?: string
  children?: React.ReactNode
}

export default function HomepageSection({
  title, background, steps, headline, headlineGreen,
  description, bullets, ctaText, ctaHref, image, imageAlt, children,
}: HomepageSectionProps) {
  const cols = steps ? steps.length * 2 - 1 : 1
  return (
    <>
      <section className="bg-white pt-24 px-6 pb-0">
        <div className="max-w-6xl mx-auto">
          {steps && (
            <div className="pb-10 border-b border-gray-100"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 0, alignItems: 'start' }}>
              {steps.map((step, i) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center text-center px-2">
                    <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">{i + 1}</div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{step.label}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex justify-center pt-3">
                      <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
                        <path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="py-16 px-6" style={{ background }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">{title}</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {headline}{headlineGreen && <> <span className="text-green-700">{headlineGreen}</span></>}
            </h2>
            <p className="text-gray-500 mb-6 leading-relaxed">{description}</p>
            <ul className="space-y-3 mb-8">
              {bullets.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
            {ctaText && ctaHref && (
              <>
                <a href={ctaHref} className="inline-flex items-center bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                  {ctaText}
                </a>
                <p className="text-xs text-gray-400 mt-3">14 days free · No credit card needed</p>
              </>
            )}
          </div>
          <div>
            {image ? <img src={image} alt={imageAlt || ''} className="w-full h-auto rounded-2xl shadow-lg" /> : children}
          </div>
        </div>
      </section>
    </>
  )
}
