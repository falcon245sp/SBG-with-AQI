import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface S3UploadResult {
  key: string;
  bucket: string;
  url: string;
  etag?: string;
}

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || 'document-processing-uploads';
    
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
  }

  /**
   * Upload a file to S3 in the customer's upload area
   * File structure: customers/{customerId}/uploads/{timestamp}-{filename}
   */
  async uploadFile(
    customerId: string, 
    file: Express.Multer.File, 
    originalFileName: string
  ): Promise<S3UploadResult> {
    const timestamp = Date.now();
    const fileId = uuidv4();
    const key = `customers/${customerId}/uploads/${timestamp}-${fileId}-${originalFileName}`;
    
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer || Buffer.from(''),
      ContentType: file.mimetype,
      Metadata: {
        'original-filename': originalFileName,
        'customer-id': customerId,
        'upload-timestamp': timestamp.toString(),
        'file-size': file.size?.toString() || '0'
      }
    };

    try {
      const result = await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      return {
        key,
        bucket: this.bucketName,
        url: `s3://${this.bucketName}/${key}`,
        etag: result.ETag
      };
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a signed URL to download a file from S3
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    try {
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file content as a buffer from S3
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    try {
      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No file content received from S3');
      }

      // Convert the stream to a buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      console.error('Failed to get file from S3:', error);
      throw new Error(`Failed to retrieve file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete file from S3:', error);
      throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List files for a specific customer
   */
  async listCustomerFiles(customerId: string): Promise<Array<{
    key: string;
    lastModified?: Date;
    size?: number;
    etag?: string;
  }>> {
    // Implementation would use ListObjectsV2Command
    // For now, return empty array as this is mainly for admin/debugging
    return [];
  }

  /**
   * Clean up old files (useful for cost management)
   */
  async cleanupOldFiles(customerId: string, olderThanDays: number = 30): Promise<number> {
    // Implementation would list objects and delete old ones
    // Return count of deleted files
    return 0;
  }
}

export const s3Service = new S3Service();