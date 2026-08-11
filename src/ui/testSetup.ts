import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)

/** jsdom kender ikke `ResizeObserver`. Mocket her holder styr på, hvilket
    element hver observatør overvåger, så en test kan udløse en ny
    målt størrelse uden en rigtig layoutmotor — se `fireResize`. */
class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = []
  private readonly callback: ResizeObserverCallback
  private readonly observed = new Set<Element>()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }

  observe(target: Element) {
    this.observed.add(target)
  }

  unobserve(target: Element) {
    this.observed.delete(target)
  }

  disconnect() {
    this.observed.clear()
  }

  isObserving(target: Element) {
    return this.observed.has(target)
  }

  fire(target: Element, size: { width: number; height: number }) {
    if (!this.observed.has(target)) return
    const entry = { target, contentRect: size } as ResizeObserverEntry
    this.callback([entry], this)
  }
}

beforeEach(() => {
  MockResizeObserver.instances = []
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

/** Udløser en ny målt størrelse for det første mockede `ResizeObserver`, der
    overvåger `target` — svarer til et vinduesskift eller en skuffe, der
    åbner eller lukker. */
export function fireResize(target: Element, size: { width: number; height: number }) {
  const observer = MockResizeObserver.instances.find((instance) => instance.isObserving(target))
  observer?.fire(target, size)
}
