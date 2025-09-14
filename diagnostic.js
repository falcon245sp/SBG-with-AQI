#!/usr/bin/env node

/**
 * Diagnostic script to test the new GPT-5 + simple prompt changes
 * Usage: node diagnostic.js <file_path>
 * Example: node diagnostic.js ./test_document.pdf
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function uploadAndAnalyze(filePath) {
    console.log('🔬 DIAGNOSTIC: Testing new GPT-5 + simple prompt configuration');
    console.log('📁 File:', filePath);
    
    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        process.exit(1);
    }

    try {
        // Step 1: Upload the document
        console.log('\n📤 Step 1: Uploading document...');
        
        // Create form data manually for upload
        const fileName = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        
        const boundary = '----formdata-diagnostic-' + Math.random().toString(16);
        const formData = [
            `--${boundary}`,
            `Content-Disposition: form-data; name="document"; filename="${fileName}"`,
            `Content-Type: application/octet-stream`,
            ``,
            fileBuffer.toString('binary'),
            `--${boundary}`,
            `Content-Disposition: form-data; name="jurisdictions"`,
            ``,
            JSON.stringify(['Common Core State Standards']),
            `--${boundary}`,
            `Content-Disposition: form-data; name="course"`,
            ``,
            'Algebra 1',
            `--${boundary}--`
        ].join('\r\n');
        
        const body = Buffer.from(formData, 'binary');

        const uploadResponse = await fetch(`${API_BASE}/documents/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: body
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('❌ Upload failed:', uploadResponse.status, errorText);
            return;
        }

        const uploadResult = await uploadResponse.json();
        console.log('✅ Upload successful:', uploadResult);
        
        const documentId = uploadResult.documentId;
        console.log('📋 Document ID:', documentId);

        // Step 2: Poll for processing completion
        console.log('\n⏳ Step 2: Waiting for analysis to complete...');
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            attempts++;
            
            console.log(`🔄 Checking status (attempt ${attempts}/${maxAttempts})...`);
            
            const statusResponse = await fetch(`${API_BASE}/documents/${documentId}`);
            if (!statusResponse.ok) {
                console.error('❌ Status check failed:', statusResponse.status);
                continue;
            }
            
            const statusResult = await statusResponse.json();
            console.log('📊 Status:', statusResult.status);
            
            if (statusResult.status === 'completed') {
                console.log('✅ Analysis completed!');
                break;
            } else if (statusResult.status === 'failed') {
                console.error('❌ Analysis failed');
                return;
            }
        }

        if (attempts >= maxAttempts) {
            console.error('⏰ Timeout waiting for analysis to complete');
            return;
        }

        // Step 3: Get the analysis results
        console.log('\n📋 Step 3: Fetching analysis results...');
        const resultsResponse = await fetch(`${API_BASE}/documents/${documentId}/results`);
        
        if (!resultsResponse.ok) {
            const errorText = await resultsResponse.text();
            console.error('❌ Results fetch failed:', resultsResponse.status, errorText);
            return;
        }

        const results = await resultsResponse.json();
        
        // Step 4: Display detailed results
        console.log('\n🎯 DIAGNOSTIC RESULTS:');
        console.log('=' .repeat(80));
        console.log('📄 Document ID:', documentId);
        console.log('📊 Total Questions Found:', results.length);
        console.log('');
        
        results.forEach((question, index) => {
            console.log(`📝 Question ${index + 1}:`);
            console.log('   Text:', question.questionText?.substring(0, 100) + '...');
            console.log('   Standards:', question.standards || 'None found');
            console.log('   Rigor Level:', question.rigorLevel);
            console.log('   Has AI Analysis:', question.hasAIAnalysis ? '✅' : '❌');
            console.log('   Raw AI Data Keys:', Object.keys(question.rawAIData || {}));
            console.log('');
        });

        // Step 5: Get the raw document details for more info
        console.log('\n🔍 RAW DOCUMENT DATA:');
        console.log('=' .repeat(80));
        const docResponse = await fetch(`${API_BASE}/documents/${documentId}`);
        const docData = await docResponse.json();
        console.log(JSON.stringify(docData, null, 2));

        console.log('\n✅ DIAGNOSTIC COMPLETE');
        console.log('🎯 Key indicators of success:');
        console.log('   - Questions found > 0');
        console.log('   - Standards identified for each question');
        console.log('   - Rigor levels assigned (mild/medium/spicy)');
        console.log('   - hasAIAnalysis = true for all questions');

    } catch (error) {
        console.error('💥 DIAGNOSTIC ERROR:', error.message);
        console.error(error.stack);
    }
}

// Check command line arguments
const filePath = process.argv[2];
if (!filePath) {
    console.error('❌ Usage: node diagnostic.js <file_path>');
    console.error('   Example: node diagnostic.js ./test_document.pdf');
    process.exit(1);
}

// Run the diagnostic
uploadAndAnalyze(filePath).catch(console.error);