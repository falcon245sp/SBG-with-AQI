import { storage } from "../storage";
import { aiService, type DocumentAnalysis } from "./aiService";
import { aqiScoringService } from "./aqiScoring";
import type { InsertAssessmentItem } from "@shared/schema";

class AssessmentAnalysisService {
  async analyzeAssessment(assessmentId: string, filePath: string): Promise<void> {
    try {
      console.log(`Starting analysis for assessment ${assessmentId}`);
      
      // Update status to processing
      await storage.updateAssessment(assessmentId, { status: "processing" });

      // Get assessment details
      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        throw new Error("Assessment not found");
      }

      // Extract text from document
      const documentText = await aiService.extractTextFromDocument(filePath);

      // Analyze document with AI
      const analysis: DocumentAnalysis = await aiService.analyzeAssessmentDocument(documentText, {
        subject: assessment.subject,
        gradeLevel: assessment.gradeLevel,
      });

      // Create assessment items
      const itemsToInsert: InsertAssessmentItem[] = analysis.items.map(item => ({
        assessmentId,
        itemNumber: item.itemNumber,
        instructionText: item.instructionText,
        problemType: item.problemType,
        mappedStandardId: item.mappedStandardId,
        observedRigor: item.observedRigor,
        alignmentScore: item.alignmentScore.toString(),
        qualityIssues: item.qualityIssues,
        aiRewriteSuggestion: item.aiRewriteSuggestion,
      }));

      await storage.bulkCreateAssessmentItems(itemsToInsert);

      // Calculate AQI scores
      const scores = await aqiScoringService.calculateAQIScores(assessmentId);

      // Generate analysis results
      const analysisResults = {
        totalItems: analysis.metadata.totalItems,
        rigorDistribution: this.calculateRigorDistribution(analysis.items),
        standardsCoverage: analysis.items
          .map(item => item.mappedStandardId)
          .filter(Boolean) as string[],
        recommendations: this.generateRecommendations(analysis.items),
      };

      // Update assessment with results
      await storage.updateAssessment(assessmentId, {
        status: "completed",
        designQualityScore: scores.designQuality.toString(),
        measurementQualityScore: scores.measurementQuality.toString(),
        standardsAlignmentScore: scores.standardsAlignment.toString(),
        overallAqiScore: scores.overall.toString(),
        analysisResults: {
          ...analysisResults,
          rigorDistribution: {
            dok1: 0,
            dok2: 0,
            dok3: 0,
            dok4: 0
          },
          legacyRigorDistribution: analysisResults.rigorDistribution
        }
      });

      console.log(`Analysis completed for assessment ${assessmentId}`);
    } catch (error) {
      console.error(`Analysis failed for assessment ${assessmentId}:`, error);
      
      // Update status to failed
      await storage.updateAssessment(assessmentId, { 
        status: "failed",
        analysisResults: {
          totalItems: 0,
          rigorDistribution: { dok1: 0, dok2: 0, dok3: 0, dok4: 0 },
        legacyRigorDistribution: { low: 0, medium: 0, high: 0 },
          standardsCoverage: [],
          recommendations: [`Analysis failed: ${error}`],
        }
      });
    }
  }

  private calculateRigorDistribution(items: any[]): { low: number; medium: number; high: number } {
    const total = items.length;
    if (total === 0) return { low: 0, medium: 0, high: 0 };

    const lowCount = items.filter(item => item.observedRigor <= 2).length;
    const mediumCount = items.filter(item => item.observedRigor >= 3 && item.observedRigor <= 4).length;
    const highCount = items.filter(item => item.observedRigor >= 5).length;

    return {
      low: Math.round((lowCount / total) * 100),
      medium: Math.round((mediumCount / total) * 100),
      high: Math.round((highCount / total) * 100),
    };
  }

  private generateRecommendations(items: any[]): string[] {
    const recommendations: string[] = [];
    
    // Check for quality issues
    const itemsWithIssues = items.filter(item => item.qualityIssues.length > 0);
    if (itemsWithIssues.length > 0) {
      recommendations.push(`${itemsWithIssues.length} items have quality issues that need attention`);
    }

    // Check rigor distribution
    const rigor = this.calculateRigorDistribution(items);
    if (rigor.low > 70) {
      recommendations.push("Consider adding more rigorous items to challenge students appropriately");
    }
    if (rigor.high > 30) {
      recommendations.push("High number of complex items - ensure students are adequately prepared");
    }

    // Check standards alignment
    const unalignedItems = items.filter(item => !item.mappedStandardId).length;
    if (unalignedItems > 0) {
      recommendations.push(`${unalignedItems} items lack clear standards alignment`);
    }

    // Check for improvement suggestions
    const itemsNeedingImprovement = items.filter(item => item.aiRewriteSuggestion).length;
    if (itemsNeedingImprovement > 0) {
      recommendations.push(`${itemsNeedingImprovement} items have AI-generated improvement suggestions`);
    }

    if (recommendations.length === 0) {
      recommendations.push("This assessment demonstrates good overall quality");
    }

    return recommendations;
  }
}

export const assessmentAnalysisService = new AssessmentAnalysisService();
