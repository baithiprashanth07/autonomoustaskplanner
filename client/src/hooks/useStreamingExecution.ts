import { useState, useCallback, useRef } from "react";

interface StreamUpdate {
  type: string;
  taskId?: string;
  message: string;
  data?: any;
}

export function useStreamingExecution() {
  const [updates, setUpdates] = useState<StreamUpdate[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startStreaming = useCallback((executionId: number, streamUrl: string) => {
    setIsStreaming(true);
    setUpdates([]);

    try {
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          setUpdates((prev) => [...prev, update]);
        } catch (error) {
          console.error("Failed to parse stream update:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("Stream error:", error);
        eventSource.close();
        setIsStreaming(false);
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("Failed to start streaming:", error);
      setIsStreaming(false);
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    updates,
    isStreaming,
    startStreaming,
    stopStreaming,
  };
}
