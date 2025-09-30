/**
 * AQI Analysis Service - Integrates the sophisticated LLM→JSON→SQL resolver
 * This service implements the advanced AQI pipeline for assessment analysis
 */

import { storage } from "../storage";
import { logger } from "../utils/logger";
import OpenAI from "openai";
import { db } from "../db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

// Configuration constants
const MODEL_PRIMARY = process.env.AQI_MODEL_PRIMARY || "gpt-4o-mini";
const MODEL_FALLBACK = process.env.AQI_MODEL_FALLBACK || "gpt-4o";
const CONF_CUTOFF = Number(process.env.AQI_CONF_CUTOFF || 0.65);

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// AQI Analysis System Prompt
const SYSTEM_PROMPT = `
You are an assessment analyst.

Input: an attached assessment file (PDF) and two hints: jurisdiction and course.
Task: For each numbered question, output the best learning standard(s) in that jurisdiction/course and the observed rigor using Webb's DOK (1–4).

Rules
- Use only the specified jurisdiction and course. If you cite a code, it must plausibly exist in that jurisdiction.
- Prefer exactly one primary standard; add up to two secondaries if clearly assessed.
- Rigor: set dokLevel 1–4; map level: 1→mild, 2–3→medium, 4→spicy; add a ≤20-word justification.
- If uncertain about the code, set unmapped=true or needs_review=true (do NOT invent codes).
- Parsing: detect numbered items; for multipart (1a, 1b), treat each as its own questionNumber if they assess different standards/rigor.
- Return ONLY JSON per schema; no chain-of-thought.
`;

// Structured Output Schema for OpenAI
const OUTPUT_SCHEMA = {
  name: "aqi_analysis",
  schema: {
    type: "object",
    required: ["documentId", "questions"],
    properties: {
      documentId: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          required: ["questionNumber", "unmapped", "needs_review", "standards", "rigor"],
          properties: {
            questionNumber: { type: "integer" },
            unmapped: { type: "boolean", default: false },
            needs_review: { type: "boolean", default: false },
            standards: {
              type: "array",
              items: {
                type: "object",
                required: ["jurisdiction", "code", "description", "isPrimary"],
                properties: {
                  jurisdiction: { type: "string" },
                  code: { type: "string" },
                  description: { type: "string" },
                  isPrimary: { type: "boolean" }
                },
                additionalProperties: false
              }
            },
            rigor: {
              type: "object",
              required: ["dokLevel", "level", "confidence", "justification"],
              properties: {
                dokLevel: { type: "integer", minimum: 1, maximum: 4 },
                level: { type: "string", enum: ["mild", "medium", "spicy"] },
                confidence: { type: "number", minimum: 0.01, maximum: 0.99 },
                justification: { type: "string" }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  },
  strict: true
} as const;

interface StandardResolutionResult {
  standard_id: string | null;
  method: "exact_code" | "desc_fuzzy" | "crosswalk" | "unresolved";
  sim?: number;
}

class AQIAnalysisService {
  /**
   * Main entry point - analyzes assessment using the AQI pipeline
   */
  async analyzeAssessment(assessmentId: string, filePath: string, jurisdiction?: string, course?: string): Promise<{ questions: any[] }> {
    try {
      logger.info('Starting AQI analysis', {
        component: 'aqi-analysis'
      });

      // Update status to processing
      await storage.updateAssessment(assessmentId, { status: "processing" });

      // Get assessment details
      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        throw new Error("Assessment not found");
      }

      // Ensure database is prepared for AQI operations
      await this.ensureDbPrepared();

      // Phase 1: AI Analysis with comprehensive error handling
      let aiResult: any = null;
      
      try {
        aiResult = await this.llmAnalyze(
          filePath,
          assessmentId,
          assessment.jurisdiction || "CCSS",
          assessment.course || assessment.subject || "",
          MODEL_PRIMARY
        );

        // Check if we received a degraded response
        if (aiResult.degraded) {
          logger.warn('Primary model returned degraded response, trying fallback', {
            component: 'aqi-analysis'
          });
          throw new Error(aiResult.technical_details || 'Primary model failed');
        }

        logger.info('Primary model analysis successful', {
          component: 'aqi-analysis'
        });
      } catch (primaryError) {
        const errorMsg = primaryError instanceof Error ? primaryError.message : 'Unknown error';
        
        logger.warn('Primary model failed, attempting fallback', {
          component: 'aqi-analysis'
        });

        // Try fallback model
        try {
          aiResult = await this.llmAnalyze(
            filePath,
            assessmentId,
            assessment.jurisdiction || "CCSS",
            assessment.course || assessment.subject || "",
            MODEL_FALLBACK
          );

          if (aiResult.degraded) {
            throw new Error(aiResult.technical_details || 'Fallback model also failed');
          }

          logger.info('Fallback model analysis successful', {
            component: 'aqi-analysis'
          });
        } catch (fallbackError) {
          const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          
          logger.error('Both primary and fallback models failed', {
            component: 'aqi-analysis'
          });

          // Create final degraded response
          aiResult = this.createDegradedResponse(assessmentId, `Primary: ${errorMsg}, Fallback: ${fallbackErrorMsg}`);
        }
      }

      // Handle degraded response case
      if (aiResult.degraded) {
        logger.warn('All AI models failed, updating assessment with error status', {
          component: 'aqi-analysis'
        });

        await storage.updateAssessment(assessmentId, {
          status: "failed",
          analysisResults: {
            totalItems: 0,
            rigorDistribution: { dok1: 0, dok2: 0, dok3: 0, dok4: 0 },
            standardsCoverage: [],
            recommendations: [
              "AI analysis failed - please try uploading the document again",
              "If the problem persists, contact support",
              `Technical details: ${aiResult.technical_details}`
            ],
          }
        });

        logger.info('Assessment marked as failed gracefully', {
          component: 'aqi-analysis'
        });
        return { questions: [] }; // Exit gracefully without throwing
      }

      // Phase 2: Confidence-based retry for low confidence items
      const needsRetry = aiResult.questions.some((q: any) => 
        q.needs_review || (q.rigor?.confidence ?? 1) < CONF_CUTOFF
      );

      if (needsRetry && MODEL_PRIMARY !== MODEL_FALLBACK) {
        try {
          logger.info('Retrying low confidence items with fallback model', {
            component: 'aqi-analysis'
          });

          const fallbackResult = await this.llmAnalyze(
            filePath,
            assessmentId,
            assessment.jurisdiction || "CCSS",
            assessment.course || assessment.subject || "",
            MODEL_FALLBACK
          );

          if (!fallbackResult.degraded) {
            // Merge results, preferring higher confidence
            aiResult = this.mergeAnalysisResults(aiResult, fallbackResult);
            logger.info('Successfully merged primary and fallback results', {
              component: 'aqi-analysis'
            });
          } else {
            logger.warn('Fallback model returned degraded response, using primary results', {
              component: 'aqi-analysis'
            });
          }
        } catch (retryError) {
          logger.warn('Fallback retry failed, continuing with primary results', {
            component: 'aqi-analysis'
          });
          // Continue with primary results
        }
      }

      // Phase 3: Standards Resolution & Database Storage
      const processedItems = [];
      let resolvedCount = 0;

      for (const question of aiResult.questions) {
        const primary = question.standards?.find((s: any) => s.isPrimary) || question.standards?.[0];
        let resolved: StandardResolutionResult = { standard_id: null, method: "unresolved" };
        let issues: string[] = [];

        if (!question.unmapped && primary) {
          resolved = await this.resolveStandardId({
            jurisdiction: assessment.jurisdiction || "CCSS",
            course: assessment.course,
            code: primary.code,
            description: primary.description || "",
            predictedJurisdiction: primary.jurisdiction
          });

          if (resolved.standard_id) {
            resolvedCount++;
          } else {
            issues.push("standard_unresolved");
          }
        } else {
          issues.push("unmapped_by_model");
        }

        // Create assessment item
        await this.upsertAssessmentItem(
          assessmentId,
          question.questionNumber,
          resolved.standard_id,
          question.rigor?.dokLevel ?? null,
          resolved.sim ?? null,
          Boolean(question.needs_review || !resolved.standard_id),
          issues
        );

        processedItems.push({
          questionNumber: question.questionNumber,
          resolvedStandardId: resolved.standard_id,
          resolverMethod: resolved.method,
          predicted: primary || null,
          rigor: question.rigor,
          needs_review: question.needs_review || !resolved.standard_id,
          unmapped: question.unmapped === true
        });
      }

      // Phase 4: Generate Analysis Results
      const analysisResults = {
        totalItems: aiResult.questions.length,
        rigorDistribution: this.calculateDOKDistribution(processedItems),
        standardsCoverage: processedItems
          .map(item => item.resolvedStandardId || item.predicted?.code) // ✅ Use OpenAI code if resolution fails
          .filter(Boolean) as string[],
        recommendations: this.generateAQIRecommendations(processedItems),
        resolutionStats: {
          totalQuestions: aiResult.questions.length,
          resolved: resolvedCount,
          unresolved: aiResult.questions.length - resolvedCount,
          needsReview: processedItems.filter(item => item.needs_review).length
        }
      };

      // Update assessment with results - with error handling
      try {
        await storage.updateAssessment(assessmentId, {
          status: "completed",
          analysisResults
        });
        
        logger.info('✅ Assessment status updated to completed', {
          component: 'aqi-analysis'
        });
      } catch (statusError) {
        logger.error('❌ Failed to update assessment status', {
          component: 'aqi-analysis'
        });
        throw statusError; // Re-throw to trigger error handling
      }

      // Store detailed results in assessment table - with error handling
      try {
        await db.execute(sql`
          UPDATE assessments
          SET analysis_results = jsonb_set(
            COALESCE(analysis_results,'{}'::jsonb), '{items}', to_jsonb(${JSON.stringify(processedItems)}::json), true
          ), updated_at = now()
          WHERE id = ${assessmentId}
        `);
        
        logger.info('✅ Assessment detailed results stored', {
          component: 'aqi-analysis'
        });
      } catch (dbError) {
        logger.error('❌ Failed to store detailed results', {
          component: 'aqi-analysis'
        });
        throw dbError; // Re-throw to trigger error handling
      }

      logger.info('AQI analysis completed successfully', {
        component: 'aqi-analysis'
      });

      return {
        questions: processedItems.map(item => ({
          questionNumber: item.questionNumber,
          questionText: aiResult.questions.find((q: any) => q.questionNumber === item.questionNumber)?.questionText || "",
          context: aiResult.questions.find((q: any) => q.questionNumber === item.questionNumber)?.context || "",
          mappedStandardId: item.resolvedStandardId,
          observedRigor: item.rigor?.dokLevel || 1,
          observedDok: item.rigor?.dokLevel || 1,
          problemType: item.predicted?.code || "",
          designMeta: {},
          stats: {}
        }))
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown system error';
      
      logger.error('AQI analysis system error', {
        component: 'aqi-analysis'
      });

      try {
        // Gracefully update assessment status
        await storage.updateAssessment(assessmentId, {
          status: "failed",
          analysisResults: {
            totalItems: 0,
            rigorDistribution: { dok1: 0, dok2: 0, dok3: 0, dok4: 0 },
            standardsCoverage: [],
            recommendations: [
              "System error during analysis - please try again",
              "If the problem persists, contact support",
              `Technical details: ${errorMsg}`
            ],
          }
        });

        logger.info('Assessment marked as failed due to system error', {
          component: 'aqi-analysis'
        });
      } catch (updateError) {
        logger.error('Failed to update assessment status after error', {
          component: 'aqi-analysis'
        });
        // Don't throw here - just log the issue
      }

      // Log for monitoring but don't throw - prevents application crashes
      logger.warn('AQI analysis completed with error but application continues', {
        component: 'aqi-analysis'
      });
      
      return { questions: [] };
    }
  }

  /**
   * Phase 1: LLM Analysis with structured outputs and comprehensive error handling
   */
  private async llmAnalyze(
    filePath: string,
    documentId: string,
    jurisdiction: string,
    course: string,
    model = MODEL_PRIMARY
  ) {
    let uploadedFileId: string | null = null;
    
    try {
      // Step 1: File Upload with error handling
      logger.info('=== UPLOADING FILE TO OPENAI ===', {
        component: 'aqi-analysis'
      });
      
      let fileBytes: Buffer;
      try {
        // Read file from filesystem with explicit error handling
        fileBytes = fs.readFileSync(filePath);
        if (!fileBytes || fileBytes.length === 0) {
          throw new Error('File is empty or could not be read');
        }
      } catch (fileError) {
        const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown file read error';
        logger.error('Failed to read PDF file', {
          component: 'aqi-analysis'
        });
        throw new Error(`File read failed: ${errorMsg}`);
      }
      
      let uploadedFile: any;
      try {
        // Ensure .pdf filename (required for Responses API)
        const fileName = `assessment_${documentId}.pdf`;
        
        // Create OpenAI file object with explicit MIME type
        const fileToUpload = await OpenAI.toFile(fileBytes, fileName, { 
          type: 'application/pdf' 
        });
        
        // Upload to OpenAI with "assistants" purpose
        uploadedFile = await openai.files.create({
          file: fileToUpload,
          purpose: "assistants"  // Required for Responses API
        });
        
        uploadedFileId = uploadedFile.id; // Store for cleanup
        
        logger.info('✅ File uploaded to OpenAI successfully', {
          component: 'aqi-analysis'
        });
      } catch (uploadError) {
        const errorMsg = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
        logger.error('Failed to upload file to OpenAI', {
          component: 'aqi-analysis'
        });
        throw new Error(`File upload failed: ${errorMsg}`);
      }

      // Step 2: File Processing with error handling
      try {
        logger.info('⏳ Waiting for file processing to complete', {
          component: 'aqi-analysis'
        });
        
        let file = await openai.files.retrieve(uploadedFile.id);
        let pollAttempts = 0;
        const maxPollAttempts = 30; // 30 seconds max
        
        while (file.status !== "processed" && pollAttempts < maxPollAttempts) {
          // Check for error states
          if (file.status === "error") {
            throw new Error(`File processing failed with status: ${file.status}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            file = await openai.files.retrieve(uploadedFile.id);
          } catch (retrieveError) {
            logger.warn('Failed to retrieve file status, retrying...', {
              component: 'aqi-analysis'
            });
            // Continue polling on temporary retrieval errors
          }
          
          pollAttempts++;
          
          if (pollAttempts % 5 === 0) {
            logger.info('📄 File processing status', {
              component: 'aqi-analysis'
            });
          }
        }
        
        if (file.status !== "processed") {
          throw new Error(`File processing timeout after ${maxPollAttempts}s. Final status: ${file.status}`);
        }
        
        logger.info('✅ File processing completed', {
          component: 'aqi-analysis'
        });
      } catch (processingError) {
        const errorMsg = processingError instanceof Error ? processingError.message : 'Unknown processing error';
        logger.error('File processing failed', {
          component: 'aqi-analysis'
        });
        throw new Error(`File processing failed: ${errorMsg}`);
      }

      // Step 3: OpenAI API Call with error handling  
      let response: any;
      try {
        const userEnvelope = { documentId, jurisdiction, course, promptVer: "aqi.vibe.v1" };

        logger.info('🤖 Making OpenAI API call', {
          component: 'aqi-analysis'
        });

        // Use Responses API with structured output
        response = await (openai as any).responses.create({
          model,
          temperature: 0.2,
          max_tokens: 10000, // Generous limit for 20+ questions
          text: {
            format: {
              type: "json_schema",
              name: OUTPUT_SCHEMA.name,
              schema: OUTPUT_SCHEMA.schema,
              strict: true
            }
          },
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { 
              role: "user", 
              content: [
                {
                  type: "input_text",
                  text: `Context: ${JSON.stringify(userEnvelope)}\n\nPlease analyze the uploaded PDF document for assessment items. Extract all numbered questions, identify the learning standards they assess, and determine their DOK rigor levels.`
                },
                { 
                  type: "input_file", 
                  file_id: uploadedFile.id
                }
              ]
            }
          ]
        });

        logger.info('✅ OpenAI API call completed', {
          component: 'aqi-analysis'
        });
      } catch (apiError) {
        const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown API error';
        logger.error('OpenAI API call failed', {
          component: 'aqi-analysis'
        });
        throw new Error(`OpenAI API failed: ${errorMsg}`);
      }

      // Step 4: Response Parsing with error handling
      try {
        const raw = response.output_text;
        if (!raw) {
          throw new Error("No response text from OpenAI model");
        }
        
        // Log the raw response for debugging - FULL RESPONSE for 20 questions
        logger.info('OpenAI raw response received', {
          component: 'aqi-analysis'
        });
        
        // Log full response to file for complete analysis
        logger.info('🔍 FULL OpenAI Response', {
          component: 'aqi-analysis'
        });
        
        // Strip markdown code blocks if present
        let cleanJson = raw.trim();
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        logger.info('Cleaned JSON for parsing', {
          component: 'aqi-analysis'
        });
        
        let parsed: any;
        try {
          parsed = JSON.parse(cleanJson);
        } catch (jsonError) {
          logger.error('JSON parsing failed', {
            component: 'aqi-analysis'
          });
          throw new Error(`Invalid JSON response from OpenAI: ${jsonError instanceof Error ? jsonError.message : 'Parse error'}`);
        }
        
        // Validate response structure (should be exact due to structured output)
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          logger.error('Invalid OpenAI response structure despite structured output', {
            component: 'aqi-analysis'
          });
          throw new Error(`Invalid response structure: expected 'questions' array, got ${typeof parsed.questions}`);
        }
        
        logger.info('OpenAI response validated successfully', {
          component: 'aqi-analysis'
        });
        
        return parsed;
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        logger.error('Response parsing failed', {
          component: 'aqi-analysis'
        });
        throw new Error(`Response parsing failed: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('LLM analysis failed', {
        component: 'aqi-analysis'
      });

      // Cleanup: Delete uploaded file if it exists
      if (uploadedFileId) {
        try {
          await openai.files.delete(uploadedFileId);
          logger.info('🗑️ Cleaned up uploaded file after error', {
            component: 'aqi-analysis'
          });
        } catch (cleanupError) {
          logger.warn('Failed to cleanup uploaded file', {
            component: 'aqi-analysis'
          });
        }
      }

      // Re-throw the error for model fallback handling
      throw new Error(`Model ${model} failed: ${errorMsg}`);
    }
  }

  /**
   * Creates a degraded response when all AI models fail
   */
  private createDegradedResponse(documentId: string, errorMessage: string): any {
    return {
      documentId,
      questions: [],
      error: 'AI analysis failed',
      message: 'Could not analyze document with AI. Please try again or contact support.',
      technical_details: errorMessage,
      degraded: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Merge results from primary and fallback models, choosing higher confidence
   */
  private mergeAnalysisResults(primary: any, fallback: any) {
    const byNum = new Map<number, any>();
    primary.questions.forEach((q: any) => byNum.set(q.questionNumber, q));

    for (const q of fallback.questions) {
      const prev = byNum.get(q.questionNumber) || q;
      const pick = (q.rigor?.confidence ?? 0) > (prev.rigor?.confidence ?? 0) ? q : prev;
      byNum.set(q.questionNumber, pick);
    }

    return {
      ...primary,
      questions: Array.from(byNum.values()).sort((a, b) => a.questionNumber - b.questionNumber)
    };
  }

  /**
   * Phase 2: Advanced Standards Resolution
   * Uses the sophisticated resolution strategy from the AQI resolver
   */
  private async resolveStandardId(args: {
    jurisdiction: string;
    course?: string | null;
    code: string;
    description: string;
    predictedJurisdiction?: string | null;
  }): Promise<StandardResolutionResult> {
    const { jurisdiction, course, code, description, predictedJurisdiction } = args;

    // Strategy 1: Exact code match within jurisdiction/course
    try {
      const exactMatch = await db.execute(sql`
        SELECT standard_id FROM standards
        WHERE jurisdiction = ${jurisdiction}
          AND (${course}::text IS NULL OR course = ${course})
          AND norm_code(code) = norm_code(${code})
        LIMIT 1
      `);

      if (exactMatch.rows[0]?.standard_id) {
        return { standard_id: exactMatch.rows[0].standard_id as string, method: "exact_code" };
      }
    } catch (error) {
      logger.warn('Exact code match failed', { component: 'aqi-analysis' });
    }

    // Strategy 2: Fuzzy description match (pg_trgm)
    try {
      const fuzzyMatch = await db.execute(sql`
        SELECT standard_id, code, similarity(description, ${description}) AS sim
        FROM standards
        WHERE jurisdiction = ${jurisdiction}
          AND (${course}::text IS NULL OR course = ${course})
        ORDER BY description <-> ${description}
        LIMIT 3
      `);

      if (fuzzyMatch.rows.length && Number(fuzzyMatch.rows[0].sim) >= 0.8) {
        return {
          standard_id: fuzzyMatch.rows[0].standard_id as string,
          method: "desc_fuzzy",
          sim: Number(fuzzyMatch.rows[0].sim)
        };
      }
    } catch (error) {
      logger.warn('Fuzzy description match failed', { component: 'aqi-analysis' });
    }

    // Strategy 3: Crosswalk hop (if predicted jurisdiction differs)
    if (predictedJurisdiction && predictedJurisdiction !== jurisdiction) {
      try {
        const crosswalkMatch = await db.execute(sql`
          WITH src AS (
            SELECT standard_id FROM standards
            WHERE jurisdiction = ${predictedJurisdiction} AND norm_code(code) = norm_code(${code})
            LIMIT 1
          )
          SELECT sc.target_standard_id AS standard_id
          FROM src
          JOIN standard_crosswalk sc ON sc.source_standard_id = src.standard_id
          JOIN standards tgt ON tgt.standard_id = sc.target_standard_id
          WHERE tgt.jurisdiction = ${jurisdiction}
          ORDER BY CASE sc.relation
                    WHEN 'equivalent' THEN 1
                    WHEN 'broader' THEN 2
                    WHEN 'narrower' THEN 2
                    ELSE 3
                  END, sc.confidence DESC
          LIMIT 1
        `);

        if (crosswalkMatch.rows[0]?.standard_id) {
          return { standard_id: crosswalkMatch.rows[0].standard_id as string, method: "crosswalk" };
        }
      } catch (error) {
        logger.warn('Crosswalk resolution failed', { component: 'aqi-analysis' });
      }
    }

    return { standard_id: null, method: "unresolved" };
  }

  /**
   * Create or update assessment item
   */
  private async upsertAssessmentItem(
    assessmentId: string,
    questionNumber: number,
    mappedStandardId: string | null,
    dokLevel: number | null,
    alignmentScore: number | null,
    needsReview: boolean,
    issues: string[] = []
  ) {
    try {
      // Create assessment item using storage interface instead of raw SQL
      await storage.createAssessmentItem({
        assessmentId,
        instructionText: `Question ${questionNumber}`,
        problemType: 'unknown',
        mappedStandardId,
        rigor: dokLevel
      });
    } catch (error) {
      logger.error('Failed to upsert assessment item', {
        component: 'aqi-analysis'
      });
    }
  }

  /**
   * Calculate DOK distribution in the format expected by the schema
   */
  private calculateDOKDistribution(items: any[]): { dok1: number; dok2: number; dok3: number; dok4: number } {
    const total = items.length;
    if (total === 0) return { dok1: 0, dok2: 0, dok3: 0, dok4: 0 };

    const dok1Count = items.filter(item => item.rigor?.dokLevel === 1).length;
    const dok2Count = items.filter(item => item.rigor?.dokLevel === 2).length;
    const dok3Count = items.filter(item => item.rigor?.dokLevel === 3).length;
    const dok4Count = items.filter(item => item.rigor?.dokLevel === 4).length;

    return {
      dok1: Math.round((dok1Count / total) * 100),
      dok2: Math.round((dok2Count / total) * 100),
      dok3: Math.round((dok3Count / total) * 100),
      dok4: Math.round((dok4Count / total) * 100)
    };
  }

  /**
   * Generate AQI-specific recommendations
   */
  private generateAQIRecommendations(items: any[]): string[] {
    const recommendations: string[] = [];

    // Resolution quality analysis
    const unresolved = items.filter(item => !item.resolvedStandardId).length;
    const needsReview = items.filter(item => item.needs_review).length;

    if (unresolved > 0) {
      recommendations.push(`${unresolved} items could not be mapped to standards and need manual review`);
    }

    if (needsReview > 0) {
      recommendations.push(`${needsReview} items flagged for review due to low confidence or complexity`);
    }

    // DOK distribution analysis
    const dokDistribution = this.calculateDOKDistribution(items);
    if (dokDistribution.dok1 > 70) {
      recommendations.push("Consider adding more cognitively demanding items (DOK 2-4) to challenge students");
    }
    if (dokDistribution.dok4 > 20) {
      recommendations.push("High proportion of DOK 4 items - ensure adequate scaffolding and preparation");
    }

    // Standards coverage analysis
    const uniqueStandards = new Set(items.map(item => item.resolvedStandardId).filter(Boolean));
    if (uniqueStandards.size < items.length * 0.5) {
      recommendations.push("Consider broadening standards coverage for more comprehensive assessment");
    }

    if (recommendations.length === 0) {
      recommendations.push("Assessment demonstrates good standards alignment and cognitive demand distribution");
    }

    return recommendations;
  }

  /**
   * Prepare database for AQI operations
   */
  private async ensureDbPrepared() {
    try {
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION norm_code(p TEXT) RETURNS TEXT
        LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(upper(COALESCE(p,'')), '[\\s._-]+', '', 'g') $$;

        ALTER TABLE standards ADD COLUMN IF NOT EXISTS code_norm TEXT;
        UPDATE standards SET code_norm = norm_code(code) WHERE code_norm IS NULL;

        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE INDEX IF NOT EXISTS idx_std_desc_trgm ON standards USING gin (description gin_trgm_ops);
      `);
    } catch (error) {
      logger.warn('Database preparation warning', { component: 'aqi-analysis' });
    }
  }
}

export const aqiAnalysisService = new AQIAnalysisService();
