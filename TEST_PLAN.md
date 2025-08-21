# Standards Sherpa - Comprehensive Test Plan

## Overview
This test plan covers all major functionality of Standards Sherpa to ensure the system works end-to-end before implementing Google Drive integration.

## Test Environment Setup
- **Browser**: Chrome/Safari/Firefox
- **Test Account**: Use existing authenticated account
- **Test Documents**: Variety of PDF/DOCX files with different question counts
- **Expected Data**: Real AI analysis results (not mock data)

---

## 1. Authentication & Access Control Tests

### Test 1.1: User Authentication
**Objective**: Verify proper login and session management
- [ ] Navigate to app URL
- [ ] Confirm Google OAuth login works
- [ ] Verify user session persists across page reloads
- [ ] Test logout functionality
- [ ] Confirm admin panel access for authorized users only

**Expected Results**: Smooth authentication flow, proper session handling, admin restrictions enforced

---

## 2. Document Upload & Processing Tests

### Test 2.1: Single Document Upload
**Objective**: Test basic document processing workflow
- [ ] Go to Upload page
- [ ] Upload a single PDF document (test with: quiz, worksheet, test)
- [ ] Upload a single DOCX document
- [ ] Verify upload progress indicators work
- [ ] Confirm document appears in File Cabinet "Uploaded" drawer
- [ ] Check processing status updates in real-time

**Test Files Needed**:
- Math quiz PDF (10-20 questions)
- Science worksheet DOCX (5-15 questions)
- English test PDF with mixed question types

**Expected Results**: Files upload successfully, appear in File Cabinet, processing begins automatically

### Test 2.2: Multi-Document Upload
**Objective**: Test batch processing capabilities
- [ ] Upload 3-5 documents simultaneously
- [ ] Verify all documents appear in queue
- [ ] Confirm processing happens for all documents
- [ ] Check that AI analysis runs for each document

**Expected Results**: All documents process without conflicts, status updates work for multiple documents

### Test 2.3: Document Re-submission
**Objective**: Test overwrite functionality
- [ ] Upload a document
- [ ] Wait for processing to complete
- [ ] Re-upload the same document
- [ ] Verify old generated documents are deleted
- [ ] Confirm new processing begins
- [ ] Check File Cabinet shows only new versions

**Expected Results**: Old documents properly deleted, new processing starts, no duplicates

---

## 3. AI Processing & Analysis Tests

### Test 3.1: Standards Detection
**Objective**: Verify AI correctly identifies educational standards
- [ ] Upload Common Core math document
- [ ] Upload NGSS science document
- [ ] Wait for AI analysis completion
- [ ] Review detected standards in Results page
- [ ] Verify standards match document content
- [ ] Check rigor level assignments (Mild/Medium/Spicy)

**Expected Results**: Accurate standards identification, appropriate rigor levels assigned

### Test 3.2: Question Parsing
**Objective**: Test question extraction and numbering
- [ ] Upload document with numbered questions (1, 2, 3...)
- [ ] Upload document with lettered questions (a, b, c...)
- [ ] Upload document with Roman numerals (i, ii, iii...)
- [ ] Verify all questions are correctly parsed
- [ ] Check question text extraction accuracy

**Expected Results**: All questions identified correctly, proper numbering maintained

### Test 3.3: Multi-Engine Consensus
**Objective**: Verify AI consensus algorithm works
- [ ] Monitor processing logs for multi-engine analysis
- [ ] Check that GPT, Claude, and Grok all participate
- [ ] Verify consensus results are reasonable
- [ ] Test with documents that might have ambiguous standards

**Expected Results**: All AI engines participate, consensus produces consistent results

---

## 4. Teacher Review & Override Tests

### Test 4.1: Review Interface
**Objective**: Test teacher review functionality
- [ ] Navigate to document with "Ready for Review" status
- [ ] Click "Accept & Proceed" button
- [ ] Verify status changes to "Reviewed and Accepted"
- [ ] Confirm cover sheet and rubric generation begins
- [ ] Test with multiple documents

**Expected Results**: Status updates properly, material generation triggers

### Test 4.2: Teacher Overrides
**Objective**: Test correction and override system
- [ ] Access teacher override interface
- [ ] Make corrections to AI analysis
- [ ] Test confidence scoring system
- [ ] Use "Revert to Sherpa" functionality
- [ ] Verify changes are saved and applied

**Expected Results**: Overrides save correctly, confidence scores work, revert function operates

---

## 5. Document Generation Tests

### Test 5.1: Cover Sheet Generation
**Objective**: Verify cover sheet PDF creation
- [ ] Process document through review workflow
- [ ] Wait for cover sheet generation
- [ ] Download and open generated cover sheet PDF
- [ ] Verify 3-column format: Question #, Standard, Rigor Level
- [ ] Confirm NO Topic column appears
- [ ] Check file naming convention
- [ ] Verify PDF is properly formatted for student use

**Expected Results**: Clean 3-column PDF, correct information, student-ready format

### Test 5.2: Rubric Generation
**Objective**: Test Standards-Based Grading rubric creation
- [ ] Generate rubric for processed document
- [ ] Open rubric PDF
- [ ] Verify 6-column table format (Criteria, Points, Full Credit, Partial Credit, Minimal Credit, No Credit)
- [ ] Check rigor indicators (* / ** / ***)
- [ ] Confirm standards alignment per question
- [ ] Verify student name field (upper right)
- [ ] Check QR code placeholder (upper left)

**Expected Results**: Professional SBG format, proper layout, teacher-ready grading tool

### Test 5.3: Document Relationship Tracking
**Objective**: Test parent-child document relationships
- [ ] Verify generated documents link to source document
- [ ] Check File Cabinet organization
- [ ] Test document preview functionality
- [ ] Confirm relationship traversal works in both directions

**Expected Results**: Clear document relationships, proper File Cabinet organization

---

## 6. File Cabinet & Document Management Tests

### Test 6.1: Three-Drawer System
**Objective**: Test File Cabinet organization
- [ ] Navigate to File Cabinet
- [ ] Switch between Uploaded, Generated, Graded drawers
- [ ] Verify documents appear in correct drawers
- [ ] Test document type identification
- [ ] Check Mac Finder-style interface functionality

**Expected Results**: Documents properly categorized, smooth drawer switching, intuitive interface

### Test 6.2: Document Preview & Download
**Objective**: Test file access and preview
- [ ] Preview documents in each drawer
- [ ] Test download functionality
- [ ] Verify file naming conventions
- [ ] Check PDF preview quality
- [ ] Test bulk download if available

**Expected Results**: Previews work correctly, downloads succeed, proper file names

### Test 6.3: Document Search & Filtering
**Objective**: Test document discovery features
- [ ] Test search functionality if available
- [ ] Try filtering by document type
- [ ] Filter by date/status
- [ ] Sort documents by various criteria

**Expected Results**: Search and filtering work as expected, results are accurate

---

## 7. Grading & Collation Tests

### Test 7.1: QR Code System
**Objective**: Test anti-fraud grading system
- [ ] Generate rubric with QR code
- [ ] Verify QR code contains unique sequence number
- [ ] Test QR code scanning (if scanner available)
- [ ] Confirm one-time use prevents duplicates

**Expected Results**: Unique QR codes generated, anti-fraud system functional

### Test 7.2: Rubric Collation
**Objective**: Test multipage PDF creation from graded rubrics
- [ ] Submit multiple graded rubrics for same assignment
- [ ] Trigger collation process
- [ ] Verify multipage PDF generation
- [ ] Check organization and formatting
- [ ] Confirm integration with File Cabinet

**Expected Results**: Clean multipage PDF, proper organization, appears in Graded drawer

---

## 8. Google Classroom Integration Tests

### Test 8.1: Roster Management
**Objective**: Test classroom integration features
- [ ] Connect Google Classroom account
- [ ] Verify roster import functionality
- [ ] Test class management features
- [ ] Check student data handling

**Expected Results**: Smooth integration, proper data handling, privacy compliance

---

## 9. Admin Panel & Debugging Tests

### Test 9.1: Admin Interface
**Objective**: Test administrative functions
- [ ] Access admin panel (authorized users only)
- [ ] Test system diagnostics tools
- [ ] Review monitoring dashboards
- [ ] Use debugging utilities

**Expected Results**: Admin functions work, diagnostics provide useful information

### Test 9.2: Data Truncation (Dev Tools)
**Objective**: Test system cleanup functionality
- [ ] Access "Dev Tools" in admin panel
- [ ] Use data truncation feature
- [ ] Verify complete database cleanup
- [ ] Confirm file system cleanup
- [ ] Test double-confirmation safeguards

**Expected Results**: Clean truncation, proper safeguards, system reset successful

---

## 10. Performance & Reliability Tests

### Test 10.1: Load Testing
**Objective**: Test system under load
- [ ] Upload multiple large documents simultaneously
- [ ] Test concurrent user scenarios
- [ ] Monitor system responsiveness
- [ ] Check memory usage and performance

**Expected Results**: System remains responsive, no crashes or errors

### Test 10.2: Error Handling
**Objective**: Test error recovery
- [ ] Upload corrupted files
- [ ] Test network interruption scenarios
- [ ] Verify error messages are helpful
- [ ] Confirm system recovers gracefully

**Expected Results**: Proper error handling, helpful messages, graceful recovery

---

## 11. Real-Time Updates & Status Tests

### Test 11.1: Status Polling
**Objective**: Verify real-time status updates
- [ ] Monitor processing status updates (2-3 second polling)
- [ ] Test teacher review status changes
- [ ] Verify export queue monitoring
- [ ] Check Dashboard updates

**Expected Results**: Status updates work reliably across all components

---

## Test Execution Notes

### Critical Success Criteria
1. **Document Processing**: End-to-end workflow from upload to generated materials
2. **Cover Sheet Format**: Proper 3-column layout without Topic column
3. **Rubric Format**: Standards-Based Grading table with rigor indicators
4. **File Cabinet**: Three-drawer organization works correctly
5. **Teacher Review**: Accept & Proceed workflow functions properly
6. **Status Updates**: Real-time polling provides accurate status

### Common Issues to Watch For
- Status polling failures
- Document relationship tracking errors
- Generated document overwrite issues
- PDF formatting problems
- File naming inconsistencies
- Database connection errors

### Test Data Requirements
- Variety of document formats (PDF, DOCX)
- Different subjects (Math, Science, English)
- Various question counts (5-25 questions)
- Different question numbering systems
- Complex and simple content

### Success Metrics
- [ ] 100% of uploaded documents process successfully
- [ ] Generated materials match expected format specifications
- [ ] File Cabinet organization is intuitive and accurate
- [ ] Teacher workflow is smooth and efficient
- [ ] Status updates are timely and accurate
- [ ] No data loss or corruption during re-processing

---

## Post-Test Actions
1. Document any bugs or issues found
2. Verify all critical workflows function end-to-end
3. Confirm system is ready for Google Drive integration
4. Update replit.md with test results and findings
5. Plan Google Drive integration branch based on test insights