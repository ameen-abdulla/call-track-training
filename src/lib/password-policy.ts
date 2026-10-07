/**
 * Shared password policy for all user-creation and password-reset flows.
 * 
 * Rules:
 *  - Min 8 characters
 *  - At least one uppercase letter
 *  - At least one digit
 *  - At least one special character
 *  - Not a known weak/common password
 */

const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', 'qwerty123',
  'iloveyou', 'admin123', 'letmein1', 'welcome1', 'monkey123',
  'dragon12', 'master12', 'abcdefgh', 'pass1234', 'test1234',
  'calltrack', 'calltrack1', 'freelancer', 'freelancer1',
])

export interface PasswordValidation {
  valid: boolean
  errors: string[]
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = []
  const pwd = password || ''

  if (pwd.length < 8) {
    errors.push('Password must be at least 8 characters long.')
  }
  if (!/[A-Z]/.test(pwd)) {
    errors.push('Password must contain at least one uppercase letter.')
  }
  if (!/[0-9]/.test(pwd)) {
    errors.push('Password must contain at least one number.')
  }
  if (!/[^A-Za-z0-9]/.test(pwd)) {
    errors.push('Password must contain at least one special character (e.g. ! @ # $ % &).')
  }
  if (COMMON_PASSWORDS.has(pwd.toLowerCase())) {
    errors.push('This password is too common. Please choose a stronger one.')
  }

  return { valid: errors.length === 0, errors }
}

export interface PasswordRuleCheck {
  id: 'length' | 'uppercase' | 'number' | 'special'
  label: string
  met: boolean
}

export function getPasswordRuleChecks(password: string): PasswordRuleCheck[] {
  const pwd = password || ''
  return [
    {
      id: 'length',
      label: '8+ characters',
      met: pwd.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'Uppercase letter (A-Z)',
      met: /[A-Z]/.test(pwd),
    },
    {
      id: 'number',
      label: 'Number (0-9)',
      met: /[0-9]/.test(pwd),
    },
    {
      id: 'special',
      label: 'Special character (e.g. !@#$)',
      met: /[^A-Za-z0-9]/.test(pwd),
    },
  ]
}

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has((password || '').toLowerCase())
}

/**
 * Sanitize a text input: trim whitespace, strip control characters.
 */
export function sanitizeText(value: string): string {
  // Remove control chars (ASCII 0-31 except tab/newline is fine, but strip null bytes etc.)
  // eslint-disable-next-line no-control-regex
  return value.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Normalize an email: lowercase + trim.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
