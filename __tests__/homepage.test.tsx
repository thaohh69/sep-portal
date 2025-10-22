import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    profile: null,
    isInitializing: false,
    logout: jest.fn(),
  }),
}))

describe('HomePage', () => {
  it('shows welcome message on initial load', () => {
    render(<HomePage />)
    expect(screen.getByText(/Welcome to the SEP internal management system/i)).toBeInTheDocument()
  })
})
