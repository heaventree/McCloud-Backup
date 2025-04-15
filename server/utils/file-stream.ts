/**
 * File Streaming Utilities
 * 
 * This module provides utilities for efficient file handling using streams,
 * which is especially important for large file operations.
 */
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import { createHash } from 'crypto';
import logger from './logger';

// Use the default logger instance
const pipelineAsync = promisify(pipeline);

/**
 * Stream copy options
 */
interface StreamCopyOptions {
  bufferSize?: number;
  overwrite?: boolean;
  gzip?: boolean;
  onProgress?: (progress: StreamProgress) => void;
}

/**
 * Stream progress information
 */
export interface StreamProgress {
  bytesRead: number;
  bytesWritten: number;
  totalBytes?: number;
  progress?: number; // 0 to 1
  filePath: string;
}

/**
 * Checksum calculation options
 */
interface ChecksumOptions {
  algorithm?: string;
  encoding?: BufferEncoding;
  bufferSize?: number;
  onProgress?: (progress: StreamProgress) => void;
}

/**
 * Determine if a file exists
 * 
 * @param filePath - Path to the file
 * @returns True if the file exists, false otherwise
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get file size
 * 
 * @param filePath - Path to the file
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    logger.error(`Failed to get file size for ${filePath}`, error);
    throw error;
  }
}

/**
 * Create a read stream
 * 
 * @param filePath - Path to the file
 * @param options - Read stream options
 * @returns Read stream
 */
export function createFileReadStream(
  filePath: string,
  options?: { bufferSize?: number; start?: number; end?: number }
) {
  const readOptions: any = {
    highWaterMark: options?.bufferSize || 64 * 1024, // 64KB default
    encoding: 'utf8'
  };
  
  if (options?.start !== undefined) {
    readOptions.start = options.start;
  }
  
  if (options?.end !== undefined) {
    readOptions.end = options.end;
  }
  
  return createReadStream(filePath, readOptions);
}

/**
 * Create a write stream
 * 
 * @param filePath - Path to the file
 * @param options - Write stream options
 * @returns Write stream
 */
export function createFileWriteStream(
  filePath: string,
  options?: { bufferSize?: number; flags?: string }
) {
  const writeOptions: any = {
    highWaterMark: options?.bufferSize || 64 * 1024, // 64KB default
    encoding: 'utf8',
    flags: options?.flags || 'w'
  };
  
  return createWriteStream(filePath, writeOptions);
}

/**
 * Stream copy a file
 * 
 * @param sourcePath - Source file path
 * @param destinationPath - Destination file path
 * @param options - Copy options
 * @returns Promise that resolves when the copy is complete
 */
export async function streamCopyFile(
  sourcePath: string,
  destinationPath: string,
  options: StreamCopyOptions = {}
): Promise<void> {
  // Default options
  const {
    bufferSize = 64 * 1024, // 64KB
    overwrite = false,
    gzip = false,
    onProgress
  } = options;
  
  // Check if the source file exists
  if (!(await fileExists(sourcePath))) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  
  // Check if the destination file exists
  if (!overwrite && (await fileExists(destinationPath))) {
    throw new Error(`Destination file already exists: ${destinationPath}`);
  }
  
  // Get source file size for progress tracking
  const totalBytes = await getFileSize(sourcePath);
  
  // Create the destination directory if it doesn't exist
  await fs.mkdir(dirname(destinationPath), { recursive: true });
  
  // Create progress tracking transform
  const progressTracker = new Transform({
    transform(chunk, encoding, callback) {
      if (onProgress) {
        this.bytesRead = (this.bytesRead || 0) + chunk.length;
        onProgress({
          bytesRead: this.bytesRead,
          bytesWritten: this.bytesRead, // Assuming 1:1 read:write ratio
          totalBytes,
          progress: totalBytes ? this.bytesRead / totalBytes : undefined,
          filePath: sourcePath
        });
      }
      callback(null, chunk);
    }
  });
  
  try {
    // Create read and write streams
    const readStream = createFileReadStream(sourcePath, { bufferSize });
    const writeStream = createFileWriteStream(destinationPath, { bufferSize });
    
    // Create pipeline with optional compression
    if (gzip) {
      await pipelineAsync(
        readStream,
        progressTracker,
        createGzip(),
        writeStream
      );
    } else {
      await pipelineAsync(
        readStream,
        progressTracker,
        writeStream
      );
    }
    
    logger.debug(`File copied: ${sourcePath} -> ${destinationPath}`);
  } catch (error) {
    logger.error(`File copy failed: ${sourcePath} -> ${destinationPath}`, error);
    
    // Attempt to clean up the partial file
    try {
      if (await fileExists(destinationPath)) {
        await fs.unlink(destinationPath);
      }
    } catch (cleanupError) {
      logger.error(`Failed to clean up partial file: ${destinationPath}`, cleanupError);
    }
    
    throw error;
  }
}

/**
 * Calculate file checksum
 * 
 * @param filePath - Path to the file
 * @param options - Checksum options
 * @returns File checksum
 */
export async function calculateFileChecksum(
  filePath: string,
  options: ChecksumOptions = {}
): Promise<string> {
  // Default options
  const {
    algorithm = 'sha256',
    encoding = 'hex',
    bufferSize = 64 * 1024, // 64KB
    onProgress
  } = options;
  
  // Check if the file exists
  if (!(await fileExists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Get file size for progress tracking
  const totalBytes = await getFileSize(filePath);
  
  return new Promise((resolve, reject) => {
    // Create read stream
    const readStream = createFileReadStream(filePath, { bufferSize });
    
    // Create hash
    const hash = createHash(algorithm);
    
    // Track progress
    let bytesRead = 0;
    
    // Handle read stream events
    readStream.on('data', (chunk) => {
      hash.update(chunk);
      
      if (onProgress) {
        bytesRead += chunk.length;
        onProgress({
          bytesRead,
          bytesWritten: 0,
          totalBytes,
          progress: totalBytes ? bytesRead / totalBytes : undefined,
          filePath
        });
      }
    });
    
    readStream.on('end', () => {
      resolve(hash.digest(encoding));
    });
    
    readStream.on('error', (error) => {
      logger.error(`Failed to calculate checksum for ${filePath}`, error);
      reject(error);
    });
  });
}

/**
 * Read a file in chunks
 * 
 * @param filePath - Path to the file
 * @param chunkSize - Size of each chunk in bytes
 * @param callback - Callback for each chunk
 * @returns Promise that resolves when the file is fully read
 */
export async function readFileInChunks(
  filePath: string,
  chunkSize: number,
  callback: (chunk: Buffer, chunkIndex: number) => Promise<void>
): Promise<void> {
  // Check if the file exists
  if (!(await fileExists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Get file size
  const fileSize = await getFileSize(filePath);
  
  // Calculate the number of chunks
  const numChunks = Math.ceil(fileSize / chunkSize);
  
  // Read each chunk
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize - 1, fileSize - 1);
    
    try {
      // Read the chunk
      const fileHandle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(end - start + 1);
      await fileHandle.read(buffer, 0, buffer.length, start);
      await fileHandle.close();
      
      // Process the chunk
      await callback(buffer, i);
    } catch (error) {
      logger.error(`Failed to read chunk ${i} from ${filePath}`, error);
      throw error;
    }
  }
}

/**
 * Extract a gzipped file
 * 
 * @param sourcePath - Source file path (gzipped)
 * @param destinationPath - Destination file path
 * @param options - Extract options
 * @returns Promise that resolves when extraction is complete
 */
export async function extractGzipFile(
  sourcePath: string,
  destinationPath: string,
  options: Omit<StreamCopyOptions, 'gzip'> = {}
): Promise<void> {
  // Check if the source file exists
  if (!(await fileExists(sourcePath))) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  
  // Check if the destination file exists
  if (!options.overwrite && (await fileExists(destinationPath))) {
    throw new Error(`Destination file already exists: ${destinationPath}`);
  }
  
  // Create the destination directory if it doesn't exist
  await fs.mkdir(dirname(destinationPath), { recursive: true });
  
  try {
    // Create read and write streams
    const readStream = createFileReadStream(sourcePath, { bufferSize: options.bufferSize });
    const writeStream = createFileWriteStream(destinationPath, { bufferSize: options.bufferSize });
    
    // Create progress tracking transform if needed
    if (options.onProgress) {
      const totalBytes = await getFileSize(sourcePath);
      const progressTracker = new Transform({
        transform(chunk, encoding, callback) {
          this.bytesRead = (this.bytesRead || 0) + chunk.length;
          options.onProgress!({
            bytesRead: this.bytesRead,
            bytesWritten: this.bytesRead,
            totalBytes,
            progress: totalBytes ? this.bytesRead / totalBytes : undefined,
            filePath: sourcePath
          });
          callback(null, chunk);
        }
      });
      
      await pipelineAsync(
        readStream,
        createGunzip(),
        progressTracker,
        writeStream
      );
    } else {
      await pipelineAsync(
        readStream,
        createGunzip(),
        writeStream
      );
    }
    
    logger.debug(`File extracted: ${sourcePath} -> ${destinationPath}`);
  } catch (error) {
    logger.error(`File extraction failed: ${sourcePath} -> ${destinationPath}`, error);
    
    // Attempt to clean up the partial file
    try {
      if (await fileExists(destinationPath)) {
        await fs.unlink(destinationPath);
      }
    } catch (cleanupError) {
      logger.error(`Failed to clean up partial file: ${destinationPath}`, cleanupError);
    }
    
    throw error;
  }
}

/**
 * Create a multi-file checksum calculator stream transform
 * 
 * @param algorithm - Hash algorithm
 * @returns Transform stream
 */
export function createChecksumTransform(algorithm: string = 'sha256'): Transform {
  const checksums = new Map<string, string>();
  let currentFile: string | null = null;
  let currentHash: any = null;
  
  return new Transform({
    objectMode: true,
    
    transform(chunk, encoding, callback) {
      // If this is a new file, start a new hash
      if (chunk.file && chunk.file !== currentFile) {
        // Finalize the previous file's hash
        if (currentFile && currentHash) {
          checksums.set(currentFile, currentHash.digest('hex'));
        }
        
        // Start a new hash for this file
        currentFile = chunk.file;
        currentHash = createHash(algorithm);
      }
      
      // Update the hash with this chunk's data
      if (currentHash && chunk.data) {
        currentHash.update(chunk.data);
      }
      
      // Pass the chunk through
      callback(null, chunk);
    },
    
    flush(callback) {
      // Finalize the last file's hash
      if (currentFile && currentHash) {
        checksums.set(currentFile, currentHash.digest('hex'));
      }
      
      // Store the checksums on the transform stream
      (this as any).checksums = checksums;
      
      callback();
    }
  });
}

/**
 * Batch process files in a directory
 * 
 * @param directoryPath - Path to the directory
 * @param processor - Function to process each file
 * @param options - Processing options
 * @returns Promise that resolves when all files are processed
 */
export async function batchProcessFiles(
  directoryPath: string,
  processor: (filePath: string) => Promise<void>,
  options: {
    concurrency?: number;
    filter?: (filePath: string) => boolean | Promise<boolean>;
    recursive?: boolean;
  } = {}
): Promise<void> {
  // Default options
  const {
    concurrency = 5,
    filter = () => true,
    recursive = false
  } = options;
  
  // Read directory contents
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  
  // Filter files and directories
  const files: string[] = [];
  const directories: string[] = [];
  
  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    
    if (entry.isDirectory() && recursive) {
      directories.push(entryPath);
    } else if (entry.isFile()) {
      // Apply filter
      if (await filter(entryPath)) {
        files.push(entryPath);
      }
    }
  }
  
  // Process files in batches
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    await Promise.all(batch.map(processor));
  }
  
  // Process subdirectories recursively
  if (recursive) {
    for (const directory of directories) {
      await batchProcessFiles(directory, processor, options);
    }
  }
}