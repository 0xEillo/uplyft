type Listener = () => void

const submittedListeners = new Set<Listener>()

export function subscribeToWorkoutDraftSubmitted(listener: Listener): () => void {
  submittedListeners.add(listener)

  return () => {
    submittedListeners.delete(listener)
  }
}

export function emitWorkoutDraftSubmitted(): void {
  submittedListeners.forEach((listener) => {
    listener()
  })
}
