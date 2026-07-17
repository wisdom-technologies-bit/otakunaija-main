import { NewsletterForm } from '@/components/newsletter-form'

interface NewsletterSignupProps {
  variant?: 'card' | 'inline' | 'hero'
  className?: string
}

export function NewsletterSignup({ variant = 'inline', className }: NewsletterSignupProps) {
  return <NewsletterForm variant={variant} className={className} />
}
