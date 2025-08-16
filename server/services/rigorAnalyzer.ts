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
   * Consolidates JSON responses from AI engines using voting methodology
   */
  consolidateJsonResponses(aiResults: {
    chatgpt: AIAnalysisResult;
    grok: AIAnalysisResult;
    claude: AIAnalysisResult;
  }): VotingResult {
    console.log('Starting JSON response consolidation with voting...');
    
    // Extract JSON responses from each AI engine
    const jsonResponses = {
      chatgpt: aiResults.chatgpt.jsonResponse || {},
      grok: aiResults.grok.jsonResponse || {},
      claude: aiResults.claude.jsonResponse || {}
    };
    
    console.log('JSON Responses:');
    console.log('ChatGPT:', JSON.stringify(jsonResponses.chatgpt, null, 2));
    console.log('Grok:', JSON.stringify(jsonResponses.grok, null, 2));
    console.log('Claude:', JSON.stringify(jsonResponses.claude, null, 2));
    
    // Extract standards from JSON responses
    const standardsFromJson = [
      jsonResponses.chatgpt.standards || [],
      jsonResponses.grok.standards || [],
      jsonResponses.claude.standards || []
    ];
    
    // Extract rigor assessments from JSON responses
    const rigorFromJson = [
      jsonResponses.chatgpt.rigor || { level: 'mild', dokLevel: 'DOK 1', justification: 'No data', confidence: 0.1 },
      jsonResponses.grok.rigor || { level: 'mild', dokLevel: 'DOK 1', justification: 'No data', confidence: 0.1 },
      jsonResponses.claude.rigor || { level: 'mild', dokLevel: 'DOK 1', justification: 'No data', confidence: 0.1 }
    ];
    
    // Vote on standards
    const standardsResult = this.voteOnStandards(standardsFromJson);
    console.log('Standards voting result:', standardsResult);
    
    // Vote on rigor levels
    const rigorResult = this.voteOnRigorLevel(rigorFromJson);
    console.log('Rigor voting result:', rigorResult);
    
    // Calculate confidence based on JSON agreement
    const confidenceScore = this.calculateJsonConfidence(jsonResponses);
    console.log('Overall confidence score:', confidenceScore);
    
    const result = {
      consensusStandards: standardsResult.standards,
      consensusRigorLevel: rigorResult.consensusLevel,
      standardsVotes: standardsResult.votes,
      rigorVotes: rigorResult.votes,
      confidenceScore
    };
    
    console.log('Final consolidated result:', result);
    return result;
  }
  
  /**
   * Original method for backward compatibility
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
  
  private calculateJsonConfidence(jsonResponses: {
    chatgpt: any;
    grok: any;
    claude: any;
  }): number {
    // Extract rigor levels for comparison
    const rigorLevels = [
      jsonResponses.chatgpt.rigor?.level || 'mild',
      jsonResponses.grok.rigor?.level || 'mild', 
      jsonResponses.claude.rigor?.level || 'mild'
    ];
    
    // Calculate rigor agreement
    const rigorAgreement = this.calculateAgreementScore(rigorLevels);
    
    // Extract all standards for overlap calculation
    const allStandards = [
      ...(jsonResponses.chatgpt.standards || []).map((s: any) => s.code),
      ...(jsonResponses.grok.standards || []).map((s: any) => s.code),
      ...(jsonResponses.claude.standards || []).map((s: any) => s.code)
    ];
    
    const uniqueStandards = new Set(allStandards);
    const standardsOverlap = allStandards.length > 0 ? 
      (allStandards.length - uniqueStandards.size) / allStandards.length : 0;
    
    // Average individual confidence scores from JSON
    const confidenceScores = [
      jsonResponses.chatgpt.rigor?.confidence || 0.1,
      jsonResponses.grok.rigor?.confidence || 0.1,
      jsonResponses.claude.rigor?.confidence || 0.1
    ];
    
    const avgIndividualConfidence = confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length;
    
    // Count successful JSON responses (not error responses)
    const successfulResponses = Object.values(jsonResponses).filter(response => 
      response && !response.error && (response.standards || response.rigor)
    ).length;
    
    const responseSuccessRate = successfulResponses / 3;
    
    // Weighted confidence calculation
    const overallConfidence = (
      rigorAgreement * 0.3 +
      standardsOverlap * 0.25 +
      avgIndividualConfidence * 0.25 +
      responseSuccessRate * 0.2
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
