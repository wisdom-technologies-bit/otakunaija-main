import type { ReactNode } from "react"
import { EnableNotifications } from "@/components/push/enable-notifications"

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <EnableNotifications />
    </>
  )
}

