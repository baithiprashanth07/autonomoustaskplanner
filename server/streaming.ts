/**
 * Streaming utilities for real-time execution updates
 */

import { Response } from "express";
import { StreamUpdate } from "@shared/types";

/**
 * Send a streaming update to the client
 */
export function sendStreamUpdate(res: Response, update: StreamUpdate) {
  const data = JSON.stringify(update);
  res.write(`data: ${data}\n\n`);
}

/**
 * Initialize a streaming response
 */
export function initializeStream(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
}

/**
 * Close a streaming response
 */
export function closeStream(res: Response) {
  res.end();
}

/**
 * Create a streaming callback for the execution engine
 */
export function createStreamCallback(res: Response) {
  return (update: StreamUpdate) => {
    try {
      sendStreamUpdate(res, update);
    } catch (error) {
      console.error("Error sending stream update:", error);
    }
  };
}
