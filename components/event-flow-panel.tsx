import { useAuth } from '@/context/auth-context'

export function EventFlowPanel() {
  const { profile } = useAuth()

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-10">
      <h2 className="text-2xl font-semibold text-slate-800">Event Request Management</h2>
      <p className="text-slate-600">This module currently serves as a placeholder. Detailed business workflows will be provided later.</p>

      <div>{profile?.id}</div>
    </div>
  )
}
