/**
 * Integration tests: call Supabase directly
 * Requires environment variables with Supabase URL/Anon Key and test credentials
 */

import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/context/auth-context'
import { createClient } from '@/lib/supabase/client'

const email = process.env.TEST_USER
const password = process.env.TEST_PW

if (!email || !password) {
  throw new Error('Missing test login credentials')
}

describe('AuthProvider integration', () => {
  afterEach(async () => {
    // prevent session leakage between tests
    const supabase = createClient()
    await supabase.auth.signOut()
  })

  it('logs in with valid credentials', async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    let response: Awaited<ReturnType<typeof result.current.login>> | undefined
    await act(async () => {
      response = await result.current.login({ email, password })
    })

    if (!response) {
      throw new Error('Expected login to return a response')
    }

    expect(response).toEqual({ success: true })

    await act(async () => {
      await result.current.logout()
    })

    unmount()
  })

  it('fails with wrong password', async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper: AuthProvider })

    let response: Awaited<ReturnType<typeof result.current.login>> | undefined
    await act(async () => {
      response = await result.current.login({ email, password: 'wrong-password' })
    })

    if (!response) {
      throw new Error('Expected login to return a response')
    }

    expect(response.success).toBe(false)
    expect(response.message).toBeTruthy()

    await act(async () => {
      await result.current.logout()
    })

    unmount()
  })
})
