'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { MENU_OPTIONS, type DepartmentKey, type MenuKey, type RoleKey } from '@/lib/app-config'
import { hasEnvVars } from '@/lib/utils'

export type StaffProfile = {
  id: string
  email: string
  username: string
  phone: string | null
  department: DepartmentKey
  role: RoleKey
  permissions: MenuKey[]
}

type LoginInput = {
  email: string
  password: string
}

type AuthResult<T = void> = {
  success: boolean
  message?: string
  data?: T
}

type AuthContextValue = {
  session: Session | null
  profile: StaffProfile | null
  isInitializing: boolean
  login: (input: LoginInput) => Promise<AuthResult>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const STAFF_TABLE = 'staff_profiles'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function normalizePermissions(input: MenuKey[] | null | undefined) {
  const safe = Array.isArray(input) ? (input.filter(Boolean) as MenuKey[]) : []
  if (!safe.includes('home')) {
    safe.unshift('home')
  }
  const menuKeys = new Set<MenuKey>(MENU_OPTIONS.map((menu) => menu.value))
  return safe.filter((permission) => menuKeys.has(permission))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => {
    if (!hasEnvVars) {
      return null
    }
    return createClient()
  }, [])
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [isInitializing, setInitializing] = useState(true)

  const fetchProfile = useCallback(
    async (userId: string) => {
      if (!supabase) {
        setProfile(null)
        return
      }

      try {
        const { data, error } = await supabase
          .from(STAFF_TABLE)
          .select('id, email, username, phone, department, role, permissions')
          .eq('id', userId)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!data) {
          setProfile(null)
          return
        }

        const permissions = normalizePermissions((data.permissions ?? []) as MenuKey[])

        setProfile({
          id: data.id,
          email: data.email,
          username: data.username,
          phone: data.phone,
          department: data.department,
          role: data.role,
          permissions,
        })
      } catch (error) {
        console.error('Unable to load profile', error)
        setProfile(null)
      }
    },
    [supabase]
  )

  useEffect(() => {
    let isMounted = true

    if (!supabase) {
      setProfile(null)
      setSession(null)
      setInitializing(false)
      return () => {
        isMounted = false
      }
    }

    const initialise = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!isMounted) return

        if (error) {
          console.error('Failed to fetch Supabase session', error)
        }

        setSession(session ?? null)

        if (session?.user) {
          void fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('Unexpected error while initialising auth state', error)
        if (isMounted) {
          setProfile(null)
          setSession(null)
        }
      } finally {
        if (isMounted) {
          setInitializing(false)
        }
      }
    }

    initialise()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)

      if (nextSession?.user) {
        void fetchProfile(nextSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const login = useCallback(
    async ({ email, password }: LoginInput): Promise<AuthResult> => {
      if (!supabase) {
        return {
          success: false,
          message: 'Supabase environment variables are not configured. Contact an administrator.',
        }
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      return { success: true }
    },
    [supabase]
  )

  const logout = useCallback(async () => {
    if (!supabase) {
      setProfile(null)
      setSession(null)
      return
    }
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id
    if (userId) {
      await fetchProfile(userId)
    }
  }, [session, fetchProfile])

  const value: AuthContextValue = {
    session,
    profile,
    isInitializing,
    login: async (input) => {
      if (!supabase) {
        return {
          success: false,
          message: 'Supabase environment variables are not configured. Contact an administrator.',
        }
      }
      return login(input)
    },
    logout: async () => {
      if (!supabase) {
        setProfile(null)
        setSession(null)
        return
      }
      await logout()
    },
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
