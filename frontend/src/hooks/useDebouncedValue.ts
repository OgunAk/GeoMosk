import { useEffect, useState } from 'react'

/** Değer <c>delayMs</c> boyunca değişmezse güncellenir (arama isteği sayısını sınırlar). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
