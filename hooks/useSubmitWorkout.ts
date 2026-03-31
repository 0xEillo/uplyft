import { useCallback, useRef, useState } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import {
  processPendingWorkoutSubmission,
  type PendingProcessStatus,
} from '@/lib/utils/workout-submission-queue'

export function useSubmitWorkout() {
  const { user } = useAuth()
  const [isProcessingPending, setIsProcessingPending] = useState(false)
  const isProcessingRef = useRef(false)

  const processPendingWorkout = useCallback(async (): Promise<
    PendingProcessStatus
  > => {
    if (isProcessingRef.current) {
      return { status: 'skipped' }
    }

    if (!user) {
      return { status: 'none' }
    }

    isProcessingRef.current = true
    setIsProcessingPending(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      return await processPendingWorkoutSubmission(session.access_token)
    } finally {
      isProcessingRef.current = false
      setIsProcessingPending(false)
    }
  }, [user])

  return {
    processPendingWorkout,
    isProcessingPending,
  }
}
