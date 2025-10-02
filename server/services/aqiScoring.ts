import { storage } from "../storage";

interface AQIScores {
  designQuality: number;
  measurementQuality: number;
  standardsAlignment: number;
  overall: number;
}

class AQIScoringService {
  async calculateAQIScores(assessmentId: string): Promise<AQIScores> {
    const items = await storage.getAssessmentItems(assessmentId);
    const assessment = await storage.getAssessment(assessmentId);
    
    if (!items.length || !assessment) {
      return { designQuality: 0, measurementQuality: 0, standardsAlignment: 0, overall: 0 };
    }

    // Get effective rigor policy for comparison
    const effectivePolicy = await storage.getEffectiveRigorPolicy(
      "district",
      assessment.districtId || "platform",
      assessment.subject,
      assessment.gradeLevel
    );

    const designQuality = this.calculateDesignQuality(items, assessment, effectivePolicy);
    const measurementQuality = this.calculateMeasurementQuality(items);
    const standardsAlignment = this.calculateStandardsAlignment(items);
    
    const overall = (designQuality + measurementQuality + standardsAlignment) / 3;

    return {
      designQuality: Math.round(designQuality * 100) / 100,
      measurementQuality: Math.round(measurementQuality * 100) / 100,
      standardsAlignment: Math.round(standardsAlignment * 100) / 100,
      overall: Math.round(overall * 100) / 100,
    };
  }

  private calculateDesignQuality(items: any[], assessment: any, policy?: any): number {
    let score = 100;

    // Check rigor distribution against policy
    if (policy?.rigorExpectations) {
      const actualRigor = this.calculateRigorDistribution(items);
      const expected = policy.rigorExpectations;

      const lowDiff = Math.abs(actualRigor.low - expected.low);
      const mediumDiff = Math.abs(actualRigor.medium - expected.medium);
      const highDiff = Math.abs(actualRigor.high - expected.high);

      // Penalize for deviations from policy (max 30 points)
      const rigorPenalty = Math.min(30, (lowDiff + mediumDiff + highDiff) / 3);
      score -= rigorPenalty;
    }

    // Check for variety in problem types (breadth) - max 20 points penalty
    const uniqueProblemTypes = new Set(items.map(item => item.problemType)).size;
    if (uniqueProblemTypes < 2) {
      score -= 20; // Lack of variety
    } else if (uniqueProblemTypes === 2) {
      score -= 10; // Limited variety
    }

    // Check for quality issues - max 25 points penalty
    const totalQualityIssues = items.reduce((sum, item) => sum + item.qualityIssues.length, 0);
    const qualityPenalty = Math.min(25, totalQualityIssues * 3);
    score -= qualityPenalty;

    // Check depth (complexity within rigor levels) - max 15 points penalty
    const rigorVariation = this.calculateRigorVariation(items);
    if (rigorVariation < 0.5) {
      score -= 15; // Too uniform, lacks depth
    }

    // Check balance (even distribution) - max 10 points penalty
    const balanceScore = this.calculateBalance(items);
    score -= (1 - balanceScore) * 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateMeasurementQuality(items: any[]): number {
    let score = 100;

    // Check reliability indicators
    // 1. Consistency in item quality (items without major issues)
    const itemsWithoutMajorIssues = items.filter(item => 
      !item.qualityIssues.some((issue: string) => 
        issue.includes('unclear') || issue.includes('multiple correct') || issue.includes('bias')
      )
    ).length;
    
    const reliabilityScore = (itemsWithoutMajorIssues / items.length) * 100;
    score = (score + reliabilityScore) / 2;

    // 2. Discrimination (variety in rigor levels suggests good discrimination)
    const rigorLevels = new Set(items.map(item => item.observedRigor)).size;
    if (rigorLevels < 2) {
      score -= 20; // Poor discrimination
    } else if (rigorLevels < 3) {
      score -= 10; // Limited discrimination
    }

    // 3. Item clarity (fewer quality issues = better measurement)
    const clarityIssues = items.filter(item => 
      item.qualityIssues.some((issue: string) => issue.includes('unclear'))
    ).length;
    
    const clarityPenalty = (clarityIssues / items.length) * 30;
    score -= clarityPenalty;

    // 4. Construct validity (appropriate rigor for grade level)
    const appropriateRigorItems = items.filter(item => {
      // Basic heuristic: items should have reasonable rigor for assessment type
      return item.observedRigor >= 1 && item.observedRigor <= 5;
    }).length;
    
    const validityScore = (appropriateRigorItems / items.length) * 100;
    score = (score + validityScore) / 2;

    return Math.max(0, Math.min(100, score));
  }

  private calculateStandardsAlignment(items: any[]): number {
    let score = 100;

    // Check how many items are aligned to standards
    const alignedItems = items.filter(item => item.mappedStandardId && item.mappedStandardId.trim()).length;
    const alignmentRate = alignedItems / items.length;
    
    // Base score on alignment rate
    score = alignmentRate * 100;

    // Bonus for high-confidence alignments
    const highConfidenceItems = items.filter(item => 
      item.alignmentScore && parseFloat(item.alignmentScore) >= 0.8
    ).length;
    
    const confidenceBonus = (highConfidenceItems / items.length) * 10;
    score += confidenceBonus;

    // Penalty for misaligned items (low alignment scores)
    const misalignedItems = items.filter(item => 
      item.alignmentScore && parseFloat(item.alignmentScore) < 0.5
    ).length;
    
    const misalignmentPenalty = (misalignedItems / items.length) * 20;
    score -= misalignmentPenalty;

    // Check for standards coverage breadth
    const uniqueStandards = new Set(
      items.map(item => item.mappedStandardId).filter(Boolean)
    ).size;
    
    if (uniqueStandards < 2 && items.length > 3) {
      score -= 15; // Limited standards coverage
    }

    return Math.max(0, Math.min(100, score));
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

  private calculateRigorVariation(items: any[]): number {
    if (items.length === 0) return 0;
    
    const rigorLevels = items.map(item => item.observedRigor);
    const mean = rigorLevels.reduce((sum, rigor) => sum + rigor, 0) / rigorLevels.length;
    const variance = rigorLevels.reduce((sum, rigor) => sum + Math.pow(rigor - mean, 2), 0) / rigorLevels.length;
    
    return Math.sqrt(variance) / 5; // Normalize to 0-1 scale
  }

  private calculateBalance(items: any[]): number {
    if (items.length === 0) return 0;

    // Calculate balance across different dimensions
    const problemTypeDistribution = this.calculateDistributionBalance(
      items.map(item => item.problemType)
    );
    
    const rigorDistribution = this.calculateDistributionBalance(
      items.map(item => item.observedRigor.toString())
    );

    return (problemTypeDistribution + rigorDistribution) / 2;
  }

  private calculateDistributionBalance(values: string[]): number {
    const counts: { [key: string]: number } = {};
    values.forEach(value => {
      counts[value] = (counts[value] || 0) + 1;
    });

    const frequencies = Object.values(counts);
    const total = values.length;
    const expected = total / frequencies.length;

    // Calculate chi-square-like balance measure
    const balance = frequencies.reduce((sum, freq) => {
      return sum + Math.pow(freq - expected, 2) / expected;
    }, 0);

    // Normalize to 0-1 scale (lower chi-square = better balance)
    return Math.max(0, 1 - (balance / total));
  }
}

export const aqiScoringService = new AQIScoringService();
