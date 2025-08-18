import { DatabaseWriteService } from './databaseWriteService.js';
import { ActiveUserService } from './activeUserService.js';
import crypto from 'crypto';

export class QrCodeService {
  
  /**
   * Generate one-time QR sequence numbers for a document and its students
   * Each QR code contains: documentId + studentId + sequenceNumber (UUID)
   * The sequence number can only be used ONCE for successful scanning
   */
  static async generateQrSequencesForDocument(
    documentId: string, 
    studentIds: string[]
  ): Promise<Array<{ studentId: string; sequenceNumber: string; qrData: string }>> {
    const activeUser = await ActiveUserService.requireActiveUser();
    
    const results = [];
    
    for (const studentId of studentIds) {
      // Generate a unique one-time sequence number (UUID)
      const sequenceNumber = crypto.randomUUID();
      
      // Create QR sequence record in database
      await DatabaseWriteService.createQrSequenceNumber({
        documentId,
        studentId,
        sequenceNumber,
      });
      
      // Generate QR data payload: documentId|studentId|sequenceNumber
      const qrData = `${documentId}|${studentId}|${sequenceNumber}`;
      
      results.push({
        studentId,
        sequenceNumber,
        qrData, // This goes into the QR code image
      });
    }
    
    console.log(`[QrCodeService] Generated ${results.length} one-time QR sequences for document ${documentId}`);
    return results;
  }
  
  /**
   * Validate and consume a QR sequence number
   * Returns success only if:
   * 1. Sequence number exists in database
   * 2. Sequence number has not been used yet (isUsed = false)
   * 3. Document and student IDs match
   * 
   * On successful validation, marks sequence as used to prevent reuse
   */
  static async validateAndConsumeQrSequence(qrData: string, scannedByTeacher: string): Promise<{
    isValid: boolean;
    documentId?: string;
    studentId?: string;
    sequenceNumberId?: string;
    reason?: string;
  }> {
    try {
      // Parse QR data: documentId|studentId|sequenceNumber
      const parts = qrData.split('|');
      if (parts.length !== 3) {
        return { isValid: false, reason: 'Invalid QR format - expected documentId|studentId|sequenceNumber' };
      }
      
      const [documentId, studentId, sequenceNumber] = parts;
      
      // Look up sequence number in database
      const qrRecord = await DatabaseWriteService.findQrSequenceNumber(sequenceNumber);
      
      if (!qrRecord) {
        return { isValid: false, reason: 'QR sequence number not found in database' };
      }
      
      if (qrRecord.isUsed) {
        console.log(`[QrCodeService] ANTI-FRAUD: Attempted reuse of QR sequence ${sequenceNumber} by ${scannedByTeacher}`);
        return { isValid: false, reason: 'QR sequence already used - duplicate submission rejected' };
      }
      
      if (qrRecord.documentId !== documentId || qrRecord.studentId !== studentId) {
        return { isValid: false, reason: 'QR data mismatch - document or student ID incorrect' };
      }
      
      // Mark sequence as used to prevent future scans
      await DatabaseWriteService.markQrSequenceAsUsed(qrRecord.id, scannedByTeacher);
      
      console.log(`[QrCodeService] SUCCESS: QR sequence ${sequenceNumber} validated and consumed for student ${studentId}`);
      return {
        isValid: true,
        documentId,
        studentId,
        sequenceNumberId: qrRecord.id,
      };
      
    } catch (error) {
      console.error('[QrCodeService] Error validating QR sequence:', error);
      return { isValid: false, reason: 'Server error during validation' };
    }
  }
  
  /**
   * Get QR sequence status for monitoring
   */
  static async getQrSequenceStatus(documentId: string): Promise<{
    total: number;
    unused: number;
    used: number;
    sequences: Array<{
      studentId: string;
      sequenceNumber: string;
      isUsed: boolean;
      usedAt?: Date;
      usedByTeacher?: string;
    }>;
  }> {
    const sequences = await DatabaseWriteService.getQrSequencesForDocument(documentId);
    
    return {
      total: sequences.length,
      unused: sequences.filter(s => !s.isUsed).length,
      used: sequences.filter(s => s.isUsed).length,
      sequences: sequences.map(s => ({
        studentId: s.studentId,
        sequenceNumber: s.sequenceNumber,
        isUsed: s.isUsed,
        usedAt: s.usedAt,
        usedByTeacher: s.usedByTeacher,
      })),
    };
  }
}