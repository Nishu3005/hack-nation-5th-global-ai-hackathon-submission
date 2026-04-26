"use client"

import { useEffect, useRef, useCallback } from "react"

type EventHandler = (data: unknown) => void

export function useEventStream(url: string, handlers: Record<string, EventHandler>) {
  const esRef = useRef<EventSource | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close()
    const es = new EventSource(url)
    esRef.current = es

    Object.keys(handlersRef.current).forEach((event) => {
      es.addEventListener(event, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          handlersRef.current[event]?.(data)
        } catch {}
      })
    })

    es.onerror = () => {
      es.close()
      setTimeout(connect, 3000)
    }
  }, [url])

  useEffect(() => {
    connect()
    return () => esRef.current?.close()
  }, [connect])
}
