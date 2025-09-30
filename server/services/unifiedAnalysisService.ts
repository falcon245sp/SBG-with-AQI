import { storage } from "../storage";
import { aiService } from "./aiService";
import { aqiAnalysisService } from "./aqiAnalysisService";
import { aqiScoringService } from "./aqiScoring";
import type { InsertQuestion, InsertAiResponse } from "../../shared/schema";

class UnifiedAnalysisService {

  async analyzeDocument(documentId: string, filePath: string): Promise<void> {
    try {
      console.log(`Starting unified analysis for document ${documentId}`);
      
      await storage.updateDocument(documentId, { processingStatus: "processing" });

      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      console.log("Processing document through both AQI and DocProcServ analysis pipelines");
      
      const [aqiResults, docProcResults] = await Promise.all([
        this.performAQIAnalysis(documentId, filePath, document),
        this.performDocProcServAnalysis(documentId, filePath, document)
      ]);

      const aqiScores = await aqiScoringService.calculateAQIScores(documentId);

      const analysisResults = this.combineAnalysisResults(aqiResults, docProcResults, document);

      const updateData: any = {
        processingStatus: "completed",
        analysisResults,
        designQualityScore: aqiScores.designQuality.toString(),
        measurementQualityScore: aqiScores.measurementQuality.toString(),
        standardsAlignmentScore: aqiScores.standardsAlignment.toString(),
        overallAqiScore: aqiScores.overall.toString(),
        status: "completed"
      };

      await storage.updateDocument(documentId, updateData);

      console.log(`Unified analysis completed for document ${documentId}`);
    } catch (error) {
      console.error(`Unified analysis failed for document ${documentId}:`, error);
      
      await storage.updateDocument(documentId, { 
        processingStatus: "failed",
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

  private isAssessmentDocument(document: any): boolean {
    return !!(document.subject && document.gradeLevel && document.assessmentType) ||
           document.fileName?.toLowerCase().includes('assessment') ||
           document.fileName?.toLowerCase().includes('test') ||
           document.fileName?.toLowerCase().includes('quiz') ||
           document.fileName?.toLowerCase().includes('exam');
  }

  private async performAQIAnalysis(documentId: string, filePath: string, document: any) {
    const jurisdiction = document.jurisdiction || document.preferredJurisdiction || "CCSS";
    const course = document.course || `${document.subject} ${document.gradeLevel}`;

    const aqiResults = await aqiAnalysisService.analyzeAssessment(
      documentId,
      filePath,
      jurisdiction,
      course
    );

    const questionsToInsert: InsertQuestion[] = aqiResults.questions.map(item => ({
      documentId,
      questionNumber: item.questionNumber,
      questionText: item.questionText,
      context: item.context,
      position: item.questionNumber,
      instructionText: item.questionText,
      problemType: item.problemType,
      mappedStandardId: item.mappedStandardId,
      rigor: item.observedRigor,
      observedDok: item.observedDok,
      designMeta: item.designMeta || {},
      stats: item.stats || {},
    }));

    await storage.bulkCreateQuestions(questionsToInsert);

    return {
      totalItems: aqiResults.questions.length,
      rigorDistribution: this.calculateDOKDistribution(aqiResults.questions),
      legacyRigorDistribution: this.calculateLegacyRigorDistribution(aqiResults.questions),
      standardsCoverage: aqiResults.questions
        .map(item => item.mappedStandardId)
        .filter(Boolean) as string[],
      recommendations: this.generateAQIRecommendations(aqiResults.questions),
    };
  }

  private async performDocProcServAnalysis(documentId: string, filePath: string, document: any) {
    const analysis = await aiService.analyzeTwoPassWithFile(
      [filePath],
      [],
      document.subject || "General",
      documentId,
      document.customerUuid
    );

    const questionsToInsert: InsertQuestion[] = analysis.canonicalAnalysis?.questions?.map((item: any, index: number) => ({
      documentId,
      questionNumber: index + 1,
      questionText: item.questionText || item.instructionText || "",
      context: item.context || "",
    })) || [];

    const createdQuestions = await storage.bulkCreateQuestions(questionsToInsert);

    const aiResponsesToInsert: InsertAiResponse[] = analysis.canonicalAnalysis?.questions?.map((item: any, index: number) => ({
      questionId: createdQuestions[index]?.id || "",
      aiEngine: "openai" as const,
      standardsIdentified: item.standardsIdentified || [],
      rigorLevel: this.mapRigorToEnum(item.observedRigor || 1),
      rigorJustification: item.rigorJustification || "",
      confidence: item.alignmentScore || 0.5,
      rawResponse: { originalResponse: item },
      processingTime: 0,
    })) || [];

    await storage.bulkCreateAiResponses(aiResponsesToInsert);

    return {
      totalItems: analysis.canonicalAnalysis?.questions?.length || 0,
      rigorDistribution: { dok1: 0, dok2: 0, dok3: 0, dok4: 0 },
      legacyRigorDistribution: this.calculateLegacyRigorDistribution(analysis.canonicalAnalysis?.questions || []),
      standardsCoverage: analysis.canonicalAnalysis?.questions
        ?.map((item: any) => item.mappedStandardId)
        .filter(Boolean) as string[] || [],
      recommendations: this.generateDocProcServRecommendations(analysis.canonicalAnalysis?.questions || []),
    };
  }

  private calculateDOKDistribution(items: any[]): { dok1: number; dok2: number; dok3: number; dok4: number } {
    const total = items.length;
    if (total === 0) return { dok1: 0, dok2: 0, dok3: 0, dok4: 0 };

    const dok1Count = items.filter(item => item.observedDok === 1).length;
    const dok2Count = items.filter(item => item.observedDok === 2).length;
    const dok3Count = items.filter(item => item.observedDok === 3).length;
    const dok4Count = items.filter(item => item.observedDok === 4).length;

    return {
      dok1: Math.round((dok1Count / total) * 100),
      dok2: Math.round((dok2Count / total) * 100),
      dok3: Math.round((dok3Count / total) * 100),
      dok4: Math.round((dok4Count / total) * 100),
    };
  }

  private calculateLegacyRigorDistribution(items: any[]): { low: number; medium: number; high: number } {
    const total = items.length;
    if (total === 0) return { low: 0, medium: 0, high: 0 };

    const lowCount = items.filter(item => (item.observedRigor || item.rigor) <= 2).length;
    const mediumCount = items.filter(item => {
      const rigor = item.observedRigor || item.rigor;
      return rigor >= 3 && rigor <= 4;
    }).length;
    const highCount = items.filter(item => (item.observedRigor || item.rigor) >= 5).length;

    return {
      low: Math.round((lowCount / total) * 100),
      medium: Math.round((mediumCount / total) * 100),
      high: Math.round((highCount / total) * 100),
    };
  }

  private generateAQIRecommendations(items: any[]): string[] {
    const recommendations: string[] = [];
    
    const itemsWithIssues = items.filter(item => item.qualityIssues?.length > 0);
    if (itemsWithIssues.length > 0) {
      recommendations.push(`${itemsWithIssues.length} items have quality issues that need attention`);
    }

    const rigor = this.calculateLegacyRigorDistribution(items);
    if (rigor.low > 70) {
      recommendations.push("Consider adding more rigorous items to challenge students appropriately");
    }
    if (rigor.high > 30) {
      recommendations.push("High number of complex items - ensure students are adequately prepared");
    }

    const unalignedItems = items.filter(item => !item.mappedStandardId).length;
    if (unalignedItems > 0) {
      recommendations.push(`${unalignedItems} items lack clear standards alignment`);
    }

    if (recommendations.length === 0) {
      recommendations.push("This assessment demonstrates good overall quality");
    }

    return recommendations;
  }

  private generateDocProcServRecommendations(items: any[]): string[] {
    const recommendations: string[] = [];
    
    const itemsWithIssues = items.filter(item => item.qualityIssues?.length > 0);
    if (itemsWithIssues.length > 0) {
      recommendations.push(`${itemsWithIssues.length} items may need review`);
    }

    const rigor = this.calculateLegacyRigorDistribution(items);
    if (rigor.low > 70) {
      recommendations.push("Consider adding more challenging questions");
    }

    const unalignedItems = items.filter(item => !item.mappedStandardId).length;
    if (unalignedItems > 0) {
      recommendations.push(`${unalignedItems} items could benefit from clearer standards alignment`);
    }

    if (recommendations.length === 0) {
      recommendations.push("Document analysis completed successfully");
    }

    return recommendations;
  }

  private mapRigorToEnum(rigor: number): "mild" | "medium" | "spicy" {
    if (rigor <= 2) return "mild";
    if (rigor <= 4) return "medium";
    return "spicy";
  }

  private combineAnalysisResults(aqiResults: any, docProcResults: any, document: any) {
    const isAssessment = this.isAssessmentDocument(document);
    
    return {
      totalItems: Math.max(aqiResults.totalItems, docProcResults.totalItems),
      
      rigorDistribution: aqiResults.rigorDistribution.dok1 > 0 ? 
        aqiResults.rigorDistribution : docProcResults.rigorDistribution,
      
      legacyRigorDistribution: {
        low: Math.round((aqiResults.legacyRigorDistribution.low + docProcResults.legacyRigorDistribution.low) / 2),
        medium: Math.round((aqiResults.legacyRigorDistribution.medium + docProcResults.legacyRigorDistribution.medium) / 2),
        high: Math.round((aqiResults.legacyRigorDistribution.high + docProcResults.legacyRigorDistribution.high) / 2)
      },
      
      standardsCoverage: Array.from(new Set([...aqiResults.standardsCoverage, ...docProcResults.standardsCoverage])),
      
      recommendations: [
        ...(isAssessment ? aqiResults.recommendations : []),
        ...docProcResults.recommendations,
        `Document processed through ${isAssessment ? 'AQI assessment analysis and' : ''} DocProcServ analysis pipelines`
      ],
      
      analysisType: isAssessment ? "assessment_and_document" : "document_with_assessment_features",
      aqiAnalysis: aqiResults,
      docProcServAnalysis: docProcResults
    };
  }
}

export const unifiedAnalysisService = new UnifiedAnalysisService();
