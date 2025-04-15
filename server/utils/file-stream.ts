/**
 * File Streaming Utilities
 * 
 * This module provides utilities for streaming file operations,
 * including chunked reading, writing, and processing of large files.
 */
import fs from 'fs';
import path from 'path';
import { Readable, Writable, Transform, pipeline } from 'stream';
import { promisify } from 'util';
import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('file-stream');
const pipelineAsync = promisify(pipeline);

// Interfaces
export interface FileChunk {
  index: number;
  data: Buffer;
  size: number;
}

export interface StreamProgress {
  bytesProcessed: number;
  totalBytes: number;
  percentage: number;
  startTime: number;
  estimatedTimeRemaining?: number;
}

export interface StreamOptions {
  chunkSize?: number;
  maxConcurrency?: number;
  onProgress?: (progress: StreamProgress) => void;
  abortSignal?: AbortSignal;
}

export interface StreamResult {
  bytesProcessed: number;
  duration: number;
  checksums?: {
    md5?: string;
    sha256?: string;
  };
}

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const DEFAULT_MAX_CONCURRENCY = 4;

/**
 * Get file stats
 * @param filePath Path to file
 * @returns File stats or null if file doesn't exist
 */
export async function getFileStats(filePath: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`Error getting file stats for ${filePath}`, error);
    }
    return null;
  }
}

/**
 * Create a readable stream from a file
 * @param filePath Path to file
 * @param options Stream options
 * @returns Readable stream
 */
export function createFileReadStream(filePath: string, options?: StreamOptions): fs.ReadStream {
  const streamOptions: fs.ReadStreamOptions = {
    highWaterMark: options?.chunkSize || DEFAULT_CHUNK_SIZE,
  };
  
  return fs.createReadStream(filePath, streamOptions);
}

/**
 * Create a writable stream to a file
 * @param filePath Path to file
 * @param options Stream options
 * @returns Writable stream
 */
export function createFileWriteStream(filePath: string, options?: StreamOptions): fs.WriteStream {
  // Ensure directory exists
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  
  const streamOptions: fs.WriteStreamOptions = {
    highWaterMark: options?.chunkSize || DEFAULT_CHUNK_SIZE,
  };
  
  return fs.createWriteStream(filePath, streamOptions);
}

/**
 * Create a progress tracking transform stream
 * @param totalBytes Total bytes to process
 * @param onProgress Progress callback
 * @returns Transform stream
 */
export function createProgressStream(totalBytes: number, onProgress?: (progress: StreamProgress) => void): Transform {
  let bytesProcessed = 0;
  const startTime = Date.now();
  
  return new Transform({
    transform(chunk, encoding, callback) {
      bytesProcessed += chunk.length;
      
      if (onProgress) {
        const progress: StreamProgress = {
          bytesProcessed,
          totalBytes,
          percentage: totalBytes ? Math.round((bytesProcessed / totalBytes) * 100) : 0,
          startTime
        };
        
        // Calculate estimated time remaining
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs > 1000 && bytesProcessed > 0 && totalBytes > 0) {
          const bytesPerMs = bytesProcessed / elapsedMs;
          const remainingBytes = totalBytes - bytesProcessed;
          progress.estimatedTimeRemaining = Math.round(remainingBytes / bytesPerMs / 1000);
        }
        
        onProgress(progress);
      }
      
      callback(null, chunk);
    }
  });
}

/**
 * Create a checksum transform stream
 * @param algorithms Hash algorithms to use
 * @returns Transform stream
 */
export function createChecksumStream(algorithms: ('md5' | 'sha256')[] = ['md5']): Transform {
  const hashes: Record<string, crypto.Hash> = {};
  
  algorithms.forEach(algorithm => {
    hashes[algorithm] = crypto.createHash(algorithm);
  });
  
  return new Transform({
    transform(chunk, encoding, callback) {
      Object.values(hashes).forEach(hash => hash.update(chunk));
      callback(null, chunk);
    },
    
    flush(callback) {
      const checksums: Record<string, string> = {};
      
      Object.entries(hashes).forEach(([algorithm, hash]) => {
        checksums[algorithm] = hash.digest('hex');
      });
      
      this.checksums = checksums;
      callback();
    }
  });
}

/**
 * Stream a file from source to destination
 * @param sourcePath Source file path
 * @param destPath Destination file path
 * @param options Stream options
 * @returns Stream result
 */
export async function streamFileCopy(sourcePath: string, destPath: string, options?: StreamOptions): Promise<StreamResult> {
  const startTime = Date.now();
  
  try {
    // Get file stats for progress tracking
    const stats = await getFileStats(sourcePath);
    if (!stats) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }
    
    // Create streams
    const readStream = createFileReadStream(sourcePath, options);
    const writeStream = createFileWriteStream(destPath, options);
    const checksumStream = createChecksumStream(['md5', 'sha256']);
    
    // Create progress stream if callback provided
    const streams: (Readable | Writable | Transform)[] = [readStream, checksumStream, writeStream];
    
    if (options?.onProgress) {
      const progressStream = createProgressStream(stats.size, options.onProgress);
      streams.splice(1, 0, progressStream);
    }
    
    // Handle abort signal
    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        readStream.destroy();
        writeStream.destroy();
      });
    }
    
    // Run pipeline
    await pipelineAsync(...streams);
    
    // Return result
    const duration = Date.now() - startTime;
    return {
      bytesProcessed: stats.size,
      duration,
      checksums: {
        md5: (checksumStream as any).checksums?.md5,
        sha256: (checksumStream as any).checksums?.sha256
      }
    };
  } catch (error) {
    logger.error(`Error streaming file from ${sourcePath} to ${destPath}`, error);
    
    // Clean up destination file if it exists and there was an error
    try {
      const destStats = await getFileStats(destPath);
      if (destStats) {
        await fs.promises.unlink(destPath);
      }
    } catch (cleanupError) {
      logger.error(`Error cleaning up destination file ${destPath}`, cleanupError);
    }
    
    throw error;
  }
}

/**
 * Process a file in chunks
 * @param filePath File path
 * @param processor Chunk processor function
 * @param options Stream options
 * @returns Stream result
 */
export async function processFileInChunks<T>(
  filePath: string,
  processor: (chunk: FileChunk) => Promise<T>,
  options?: StreamOptions
): Promise<{ result: StreamResult, processed: T[] }> {
  const startTime = Date.now();
  const processed: T[] = [];
  
  try {
    // Get file stats for progress tracking
    const stats = await getFileStats(filePath);
    if (!stats) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const chunkSize = options?.chunkSize || DEFAULT_CHUNK_SIZE;
    const concurrency = options?.maxConcurrency || DEFAULT_MAX_CONCURRENCY;
    
    // Create read stream
    const readStream = createFileReadStream(filePath, {
      ...options,
      chunkSize
    });
    
    // Process chunks
    let bytesProcessed = 0;
    let chunkIndex = 0;
    let activePromises = 0;
    let error: Error | null = null;
    
    // Progress tracking
    const updateProgress = () => {
      if (options?.onProgress) {
        const progress: StreamProgress = {
          bytesProcessed,
          totalBytes: stats.size,
          percentage: Math.round((bytesProcessed / stats.size) * 100),
          startTime
        };
        
        // Calculate estimated time remaining
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs > 1000 && bytesProcessed > 0) {
          const bytesPerMs = bytesProcessed / elapsedMs;
          const remainingBytes = stats.size - bytesProcessed;
          progress.estimatedTimeRemaining = Math.round(remainingBytes / bytesPerMs / 1000);
        }
        
        options.onProgress(progress);
      }
    };
    
    return new Promise((resolve, reject) => {
      // Handle abort signal
      if (options?.abortSignal) {
        options.abortSignal.addEventListener('abort', () => {
          error = new Error('Operation aborted');
          readStream.destroy();
        });
      }
      
      const processChunk = async (data: Buffer, index: number) => {
        try {
          if (error) return;
          
          const chunk: FileChunk = {
            index,
            data,
            size: data.length
          };
          
          const result = await processor(chunk);
          processed[index] = result;
          
          bytesProcessed += data.length;
          updateProgress();
          
          activePromises--;
        } catch (err) {
          error = err as Error;
          readStream.destroy();
        }
      };
      
      readStream.on('data', (data: Buffer) => {
        if (error) return;
        
        // Limit concurrency
        if (activePromises >= concurrency) {
          readStream.pause();
        }
        
        const index = chunkIndex++;
        activePromises++;
        
        processChunk(data, index).finally(() => {
          if (readStream.isPaused() && activePromises < concurrency && !error) {
            readStream.resume();
          }
        });
      });
      
      readStream.on('end', () => {
        // Wait for all processing to complete
        const checkComplete = () => {
          if (activePromises === 0 || error) {
            if (error) {
              reject(error);
            } else {
              resolve({
                result: {
                  bytesProcessed,
                  duration: Date.now() - startTime
                },
                processed
              });
            }
          } else {
            setTimeout(checkComplete, 10);
          }
        };
        
        checkComplete();
      });
      
      readStream.on('error', (err) => {
        error = err;
        reject(err);
      });
    });
  } catch (error) {
    logger.error(`Error processing file ${filePath} in chunks`, error);
    throw error;
  }
}

/**
 * Create a chunked upload stream from a file
 * This is useful for uploading large files to APIs with size limitations
 * @param filePath File path
 * @param options Stream options
 * @returns Generator of file chunks
 */
export async function* createChunkedUploadStream(
  filePath: string,
  options?: StreamOptions
): AsyncGenerator<FileChunk> {
  const chunkSize = options?.chunkSize || DEFAULT_CHUNK_SIZE;
  
  // Get file stats
  const stats = await getFileStats(filePath);
  if (!stats) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const totalChunks = Math.ceil(stats.size / chunkSize);
  const fd = await fs.promises.open(filePath, 'r');
  let bytesProcessed = 0;
  const startTime = Date.now();
  
  try {
    for (let i = 0; i < totalChunks; i++) {
      // Check abort signal
      if (options?.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const buffer = Buffer.alloc(chunkSize);
      const { bytesRead } = await fd.read(buffer, 0, chunkSize, i * chunkSize);
      
      if (bytesRead === 0) break;
      
      // Trim buffer if less than chunk size
      const chunk: FileChunk = {
        index: i,
        data: bytesRead < chunkSize ? buffer.slice(0, bytesRead) : buffer,
        size: bytesRead
      };
      
      bytesProcessed += bytesRead;
      
      // Report progress
      if (options?.onProgress) {
        const progress: StreamProgress = {
          bytesProcessed,
          totalBytes: stats.size,
          percentage: Math.round((bytesProcessed / stats.size) * 100),
          startTime
        };
        
        // Calculate estimated time remaining
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs > 1000 && bytesProcessed > 0) {
          const bytesPerMs = bytesProcessed / elapsedMs;
          const remainingBytes = stats.size - bytesProcessed;
          progress.estimatedTimeRemaining = Math.round(remainingBytes / bytesPerMs / 1000);
        }
        
        options.onProgress(progress);
      }
      
      yield chunk;
    }
  } finally {
    await fd.close();
  }
}

/**
 * Calculate file checksum
 * @param filePath File path
 * @param algorithm Hash algorithm
 * @param options Stream options
 * @returns Checksum
 */
export async function calculateFileChecksum(
  filePath: string,
  algorithm: 'md5' | 'sha256' = 'md5',
  options?: StreamOptions
): Promise<string> {
  try {
    // Get file stats for progress tracking
    const stats = await getFileStats(filePath);
    if (!stats) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Create streams
    const readStream = createFileReadStream(filePath, options);
    const hash = crypto.createHash(algorithm);
    
    // Create progress stream if callback provided
    if (options?.onProgress) {
      const progressStream = createProgressStream(stats.size, options.onProgress);
      await pipelineAsync(readStream, progressStream, hash);
    } else {
      await pipelineAsync(readStream, hash);
    }
    
    return hash.digest('hex');
  } catch (error) {
    logger.error(`Error calculating ${algorithm} checksum for ${filePath}`, error);
    throw error;
  }
}