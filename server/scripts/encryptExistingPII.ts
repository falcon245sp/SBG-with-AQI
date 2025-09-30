#!/usr/bin/env tsx

/**
 * Migration script to encrypt existing PII data in the database
 * This should be run once after implementing PII encryption
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { PIIEncryption } from "../utils/encryption";
import { eq } from "drizzle-orm";

async function encryptExistingUserPII() {
  console.log('🔐 Starting PII encryption migration...');
  
  try {
    // Get all users with unencrypted data
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users to process`);
    
    for (const user of allUsers) {
      console.log(`Processing user ${user.id}...`);
      
      // Check if data is already encrypted (encrypted data will fail to decrypt)
      let isAlreadyEncrypted = false;
      try {
        if (user.email) {
          PIIEncryption.decrypt(user.email);
          isAlreadyEncrypted = true;
        }
      } catch {
        // Data is not encrypted, proceed with encryption
      }
      
      if (isAlreadyEncrypted) {
        console.log(`User ${user.id} already has encrypted PII, skipping...`);
        continue;
      }
      
      // Encrypt PII fields
      const encryptedData = PIIEncryption.encryptUserPII({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      });
      
      // Update user with encrypted data
      await db
        .update(users)
        .set({
          email: encryptedData.email,
          firstName: encryptedData.firstName,
          lastName: encryptedData.lastName,
          profileImageUrl: encryptedData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
        
      console.log(`✅ Encrypted PII for user ${user.id}`);
    }
    
    console.log('🎉 PII encryption migration completed successfully!');
    
  } catch (error) {
    console.error('❌ PII encryption migration failed:', error);
    throw error;
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  encryptExistingUserPII()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { encryptExistingUserPII };