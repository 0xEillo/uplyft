type SelectionPayload = { id: string; name: string }

function loadHook() {
  jest.resetModules()
  jest.doMock('react', () => ({
    __esModule: true,
    useCallback: (fn: unknown) => fn,
    useRef: (initialValue: unknown) => ({ current: initialValue }),
  }))

  return jest.requireActual(
    '@/hooks/useExerciseSelection',
  ) as typeof import('@/hooks/useExerciseSelection')
}

describe('useExerciseSelection', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.dontMock('react')
  })

  it('passes a registered selection from one hook instance to another', () => {
    const { useExerciseSelection } = loadHook()
    const registerSide = useExerciseSelection()
    const consumeSide = useExerciseSelection()
    const callback = jest.fn()
    const payload: SelectionPayload = { id: 'bench', name: 'Bench Press' }

    registerSide.registerCallback(callback)
    consumeSide.callCallback(payload as any)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(payload)
  })

  it('consumes the callback only once even if callCallback is triggered twice', () => {
    const { useExerciseSelection } = loadHook()
    const source = useExerciseSelection()
    const target = useExerciseSelection()
    const callback = jest.fn()
    const payload: SelectionPayload = { id: 'squat', name: 'Squat' }

    source.registerCallback(callback)

    target.callCallback(payload as any)
    target.callCallback(payload as any)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(payload)
  })

  it('lets the most recent registration replace the previous callback', () => {
    const { useExerciseSelection } = loadHook()
    const hookA = useExerciseSelection()
    const hookB = useExerciseSelection()
    const firstCallback = jest.fn()
    const secondCallback = jest.fn()
    const payload: SelectionPayload = { id: 'deadlift', name: 'Deadlift' }

    hookA.registerCallback(firstCallback)
    hookB.registerCallback(secondCallback)

    hookA.callCallback(payload as any)

    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledTimes(1)
    expect(secondCallback).toHaveBeenCalledWith(payload)
  })

  it('does nothing after the pending callback is cleared by another instance', () => {
    const { useExerciseSelection } = loadHook()
    const registerSide = useExerciseSelection()
    const clearSide = useExerciseSelection()
    const consumeSide = useExerciseSelection()
    const callback = jest.fn()
    const payload: SelectionPayload = { id: 'row', name: 'Barbell Row' }

    registerSide.registerCallback(callback)
    clearSide.clearCallback()

    expect(() => consumeSide.callCallback(payload as any)).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
  })

  it('safely no-ops when no callback is registered', () => {
    const { useExerciseSelection } = loadHook()
    const hook = useExerciseSelection()
    const payload: SelectionPayload = { id: 'press', name: 'Overhead Press' }

    expect(() => hook.callCallback(payload as any)).not.toThrow()
  })
})
