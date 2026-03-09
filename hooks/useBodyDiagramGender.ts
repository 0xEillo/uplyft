import { useProfile } from '@/contexts/profile-context'

export function useBodyDiagramGender(): 'male' | 'female' {
  const { profile } = useProfile()

  return profile?.gender === 'female' ? 'female' : 'male'
}
