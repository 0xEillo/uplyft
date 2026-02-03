type Store = Record<string, string>

const stores: Record<string, Store> = {}

function getStore(id: string): Store {
  if (!stores[id]) {
    stores[id] = {}
  }
  return stores[id]
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

  set(key: string, value: string): void {
    getStore(this.id)[key] = String(value)
  }

  delete(key: string): void {
    delete getStore(this.id)[key]
  }

  static __getStore(id = 'default'): Store {
    return { ...getStore(id) }
  }

  static __clearAll(): void {
    Object.keys(stores).forEach((id) => {
      stores[id] = {}
    })
  }
}
