'use client'

import React from 'react'
import { Check, CheckCircle2, AlertCircle } from 'lucide-react'
import { getPasswordRuleChecks, isCommonPassword } from '@/lib/password-policy'

interface PasswordRequirementsProps {
  password?: string
  showFeedback?: boolean
  className?: string
}

export function PasswordRequirements({
  password = '',
  showFeedback = true,
  className = '',
}: PasswordRequirementsProps) {
  const rules = getPasswordRuleChecks(password)
  const isCommon = isCommonPassword(password)
  const hasTyped = (password || '').length > 0
  const allRulesMet = rules.every(r => r.met)

  return (
    <div className={`space-y-1.5 mt-1.5 ${className}`}>
      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
        Min 8 chars, including at least one uppercase letter, one number, and one special character.
      </p>

      {showFeedback && hasTyped && (
        <div className="p-2.5 rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] space-y-1.5">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center gap-1.5 transition-colors ${
                  rule.met
                    ? 'text-[var(--success)] font-medium'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {rule.met ? (
                  <Check className="w-3 h-3 text-[var(--success)] shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)] shrink-0 ml-0.5 mr-1" />
                )}
                <span>{rule.label}</span>
              </div>
            ))}
          </div>

          {isCommon && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--danger)] pt-0.5 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>This password is too common. Please choose a stronger one.</span>
            </div>
          )}

          {allRulesMet && !isCommon && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--success)] pt-0.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Password meets all requirements</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
