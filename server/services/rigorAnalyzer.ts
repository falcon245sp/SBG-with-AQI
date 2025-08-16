import { AIAnalysisResult, EducationalStandard, RigorAssessment } from './aiService';

interface VotingResult {
  consensusStandards: EducationalStandard[];
  consensusRigorLevel: 'mild' | 'medium' | 'spicy';
  standardsVotes: any;
  rigorVotes: any;
  confidenceScore: number;
}

export class RigorAnalyzer {
  /**
   * Consolidates responses from three AI engines using voting methodology
   */
  consolidateResponses(aiResults: {
    chatgpt: AIAnalysisResult;
    grok: AIAnalysisResult;
    claude: AIAnalysisResult;
  }): VotingResult {
    const { chatgpt, grok, claude } = aiResults;
    
    // Consolidate standards using voting
    const consensusStandards = this.voteOnStandards([
      chatgpt.standards,
      grok.standards,
      claude.standards
    ]);

    // Consolidate rigor levels using voting
    const rigorVoting = this.voteOnRigorLevel([
      chatgpt.rigor,
      grok.rigor,
      claude.rigor
    ]);

    // Calculate overall confidence based on agreement
    const confidenceScore = this.calculateConfidence(aiResults);

    return {
      consensusStandards: consensusStandards.standards,
      consensusRigorLevel: rigorVoting.consensusLevel,
      standardsVotes: consensusStandards.votes,
      rigorVotes: rigorVoting.votes,
      confidenceScore
    };
  }

  private voteOnStandards(standardSets: EducationalStandard[][]): {
    standards: EducationalStandard[];
    votes: any;
  } {
    const standardCounts = new Map<string, {
      standard: EducationalStandard;
      count: number;
      sources: string[];
    }>();

    // Count occurrences of each standard
    standardSets.forEach((standards, index) => {
      const sourceName = ['chatgpt', 'grok', 'claude'][index];
      
      standards.forEach(standard => {
        const key = `${standard.code}-${standard.jurisdiction}`;
        
        if (standardCounts.has(key)) {
          const existing = standardCounts.get(key)!;
          existing.count++;
          existing.sources.push(sourceName);
        } else {
          standardCounts.set(key, {
            standard,
            count: 1,
            sources: [sourceName]
          });
        }
      });
    });

    // Sort by count and take top standards
    const sortedStandards = Array.from(standardCounts.values())
      .sort((a, b) => b.count - a.count);

    // Take standards that have at least 2 votes or the most voted ones
    const consensusStandards = sortedStandards
      .filter(item => item.count >= 2)
      .slice(0, 2)
      .map(item => item.standard);

    // If no consensus, take the most voted ones
    if (consensusStandards.length === 0 && sortedStandards.length > 0) {
      consensusStandards.push(sortedStandards[0].standard);
    }

    const votes = Object.fromEntries(
      Array.from(standardCounts.entries()).map(([key, value]) => [
        key,
        {
          count: value.count,
          sources: value.sources,
          standard: value.standard
        }
      ])
    );

    return {
      standards: consensusStandards,
      votes
    };
  }

  private voteOnRigorLevel(rigorAssessments: RigorAssessment[]): {
    consensusLevel: 'mild' | 'medium' | 'spicy';
    votes: any;
  } {
    const rigorCounts = {
      mild: 0,
      medium: 0,
      spicy: 0
    };

    const rigorSources = {
      mild: [] as string[],
      medium: [] as string[],
      spicy: [] as string[]
    };

    // Count rigor level votes
    rigorAssessments.forEach((rigor, index) => {
      const sourceName = ['chatgpt', 'grok', 'claude'][index];
      
      if (rigor.level in rigorCounts) {
        rigorCounts[rigor.level]++;
        rigorSources[rigor.level].push(sourceName);
      }
    });

    // Find the rigor level with the most votes
    let consensusLevel: 'mild' | 'medium' | 'spicy' = 'mild';
    let maxVotes = 0;

    Object.entries(rigorCounts).forEach(([level, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        consensusLevel = level as 'mild' | 'medium' | 'spicy';
      }
    });

    const votes = {
      mild: {
        count: rigorCounts.mild,
        sources: rigorSources.mild,
        assessments: rigorAssessments.filter(r => r.level === 'mild')
      },
      medium: {
        count: rigorCounts.medium,
        sources: rigorSources.medium,
        assessments: rigorAssessments.filter(r => r.level === 'medium')
      },
      spicy: {
        count: rigorCounts.spicy,
        sources: rigorSources.spicy,
        assessments: rigorAssessments.filter(r => r.level === 'spicy')
      }
    };

    return {
      consensusLevel,
      votes
    };
  }

  private calculateConfidence(aiResults: {
    chatgpt: AIAnalysisResult;
    grok: AIAnalysisResult;
    claude: AIAnalysisResult;
  }): number {
    const { chatgpt, grok, claude } = aiResults;
    
    // Calculate rigor agreement
    const rigorLevels = [chatgpt.rigor.level, grok.rigor.level, claude.rigor.level];
    const rigorAgreement = this.calculateAgreementScore(rigorLevels);
    
    // Calculate standards overlap
    const allStandards = [
      ...chatgpt.standards.map(s => s.code),
      ...grok.standards.map(s => s.code),
      ...claude.standards.map(s => s.code)
    ];
    
    const uniqueStandards = new Set(allStandards);
    const standardsOverlap = allStandards.length > 0 ? 
      (allStandards.length - uniqueStandards.size) / allStandards.length : 0;
    
    // Average individual confidence scores
    const avgIndividualConfidence = (
      chatgpt.rigor.confidence +
      grok.rigor.confidence +
      claude.rigor.confidence
    ) / 3;
    
    // Weighted confidence calculation
    const overallConfidence = (
      rigorAgreement * 0.4 +
      standardsOverlap * 0.3 +
      avgIndividualConfidence * 0.3
    );
    
    return Math.round(overallConfidence * 100) / 100;
  }

  private calculateAgreementScore(values: string[]): number {
    if (values.length === 0) return 0;
    
    const counts = values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const maxCount = Math.max(...Object.values(counts));
    return maxCount / values.length;
  }
}

export const rigorAnalyzer = new RigorAnalyzer();
