type Store = Record<string, string>
type Listener = (key: string) => void

const stores: Record<string, Store> = {}
const listeners: Record<string, Listener[]> = {}

function getStore(id: string): Store {
  if (!stores[id]) {
    stores[id] = {}
  }
  return stores[id]
}

function getListeners(id: string): Listener[] {
  if (!listeners[id]) {
    listeners[id] = []
  }
  return listeners[id]
}

export class MMKV {
  private id: string

  constructor(options?: { id?: string }) {
    this.id = options?.id ?? 'default'
    getStore(this.id)
  }

  getString(key: string): string | undefined {
    return getStore(this.id)[key]
  }

  getBoolean(key: string): boolean | undefined {
    const value = getStore(this.id)[key]
    if (value === undefined) return undefined
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
  }

  set(key: string, value: string | boolean | number): void {
    getStore(this.id)[key] = String(value)
    getListeners(this.id).forEach((listener) => listener(key))
  }

  delete(key: string): void {
    delete getStore(this.id)[key]
    getListeners(this.id).forEach((listener) => listener(key))
  }

  addOnValueChangedListener(listener: Listener): { remove: () => void } {
    const currentListeners = getListeners(this.id)
    currentListeners.push(listener)

    return {
      remove: () => {
        const index = currentListeners.indexOf(listener)
        if (index >= 0) {
          currentListeners.splice(index, 1)
        }
      },
    }
  }

  static __getStore(id = 'default'): Store {
    return { ...getStore(id) }
  }

  static __clearAll(): void {
    Object.keys(stores).forEach((id) => {
      stores[id] = {}
    })
    Object.keys(listeners).forEach((id) => {
      listeners[id] = []
    })
  }
}
