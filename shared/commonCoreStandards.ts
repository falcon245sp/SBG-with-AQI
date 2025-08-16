// Common Core Standards Reference
// This is a subset of major Common Core standards for validation

export interface CommonCoreStandard {
  code: string;
  description: string;
  subject: 'Math' | 'ELA';
  gradeLevel: string;
  domain?: string;
}

export const COMMON_CORE_MATH_STANDARDS: CommonCoreStandard[] = [
  // Kindergarten
  { code: 'K.CC.A.1', description: 'Count to 100 by ones and by tens', subject: 'Math', gradeLevel: 'K', domain: 'Counting & Cardinality' },
  { code: 'K.CC.A.2', description: 'Count forward beginning from a given number', subject: 'Math', gradeLevel: 'K', domain: 'Counting & Cardinality' },
  { code: 'K.CC.A.3', description: 'Write numbers from 0 to 20', subject: 'Math', gradeLevel: 'K', domain: 'Counting & Cardinality' },
  
  // Grade 1
  { code: '1.OA.A.1', description: 'Use addition and subtraction within 20 to solve word problems', subject: 'Math', gradeLevel: '1', domain: 'Operations & Algebraic Thinking' },
  { code: '1.OA.A.2', description: 'Solve word problems that call for addition of three whole numbers', subject: 'Math', gradeLevel: '1', domain: 'Operations & Algebraic Thinking' },
  { code: '1.NBT.A.1', description: 'Count to 120, starting at any number less than 120', subject: 'Math', gradeLevel: '1', domain: 'Number & Operations in Base Ten' },
  
  // Grade 2
  { code: '2.OA.A.1', description: 'Use addition and subtraction within 100 to solve one- and two-step word problems', subject: 'Math', gradeLevel: '2', domain: 'Operations & Algebraic Thinking' },
  { code: '2.NBT.A.1', description: 'Understand that the three digits of a three-digit number represent amounts', subject: 'Math', gradeLevel: '2', domain: 'Number & Operations in Base Ten' },
  { code: '2.MD.A.1', description: 'Measure the length of an object by selecting and using appropriate tools', subject: 'Math', gradeLevel: '2', domain: 'Measurement & Data' },
  
  // Grade 3
  { code: '3.OA.A.1', description: 'Interpret products of whole numbers', subject: 'Math', gradeLevel: '3', domain: 'Operations & Algebraic Thinking' },
  { code: '3.NBT.A.1', description: 'Use place value understanding to round whole numbers', subject: 'Math', gradeLevel: '3', domain: 'Number & Operations in Base Ten' },
  { code: '3.NF.A.1', description: 'Understand a fraction 1/b as the quantity formed by 1 part', subject: 'Math', gradeLevel: '3', domain: 'Number & Operations—Fractions' },
  
  // Grade 4
  { code: '4.OA.A.1', description: 'Interpret a multiplication equation as a comparison', subject: 'Math', gradeLevel: '4', domain: 'Operations & Algebraic Thinking' },
  { code: '4.NBT.A.1', description: 'Recognize that in a multi-digit whole number, a digit represents 10 times', subject: 'Math', gradeLevel: '4', domain: 'Number & Operations in Base Ten' },
  { code: '4.NF.A.1', description: 'Explain why a fraction a/b is equivalent to a fraction (n×a)/(n×b)', subject: 'Math', gradeLevel: '4', domain: 'Number & Operations—Fractions' },
  
  // Grade 5
  { code: '5.OA.A.1', description: 'Use parentheses, brackets, or braces in numerical expressions', subject: 'Math', gradeLevel: '5', domain: 'Operations & Algebraic Thinking' },
  { code: '5.NBT.A.1', description: 'Recognize that in a multi-digit number, a digit represents 10 times', subject: 'Math', gradeLevel: '5', domain: 'Number & Operations in Base Ten' },
  { code: '5.NF.A.1', description: 'Add and subtract fractions with unlike denominators', subject: 'Math', gradeLevel: '5', domain: 'Number & Operations—Fractions' },
  
  // Grade 6
  { code: '6.RP.A.1', description: 'Understand the concept of a ratio and use ratio language', subject: 'Math', gradeLevel: '6', domain: 'Ratios & Proportional Relationships' },
  { code: '6.NS.A.1', description: 'Interpret and compute quotients of fractions', subject: 'Math', gradeLevel: '6', domain: 'The Number System' },
  { code: '6.EE.A.1', description: 'Write and evaluate numerical expressions involving whole-number exponents', subject: 'Math', gradeLevel: '6', domain: 'Expressions & Equations' },
  
  // Grade 7
  { code: '7.RP.A.1', description: 'Compute unit rates associated with ratios of fractions', subject: 'Math', gradeLevel: '7', domain: 'Ratios & Proportional Relationships' },
  { code: '7.NS.A.1', description: 'Apply and extend previous understandings of addition and subtraction', subject: 'Math', gradeLevel: '7', domain: 'The Number System' },
  { code: '7.EE.A.1', description: 'Apply properties of operations as strategies to add, subtract, factor', subject: 'Math', gradeLevel: '7', domain: 'Expressions & Equations' },
  
  // Grade 8
  { code: '8.NS.A.1', description: 'Know that numbers that are not rational are called irrational', subject: 'Math', gradeLevel: '8', domain: 'The Number System' },
  { code: '8.EE.A.1', description: 'Know and apply the properties of integer exponents', subject: 'Math', gradeLevel: '8', domain: 'Expressions & Equations' },
  { code: '8.F.A.1', description: 'Understand that a function is a rule that assigns to each input', subject: 'Math', gradeLevel: '8', domain: 'Functions' },
  { code: '8.G.A.1', description: 'Verify experimentally the properties of rotations, reflections, and translations', subject: 'Math', gradeLevel: '8', domain: 'Geometry' },
  
  // High School Algebra
  { code: 'A-SSE.A.1', description: 'Interpret expressions that represent a quantity in terms of its context', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Seeing Structure in Expressions' },
  { code: 'A-SSE.A.2', description: 'Use the structure of an expression to identify ways to rewrite it', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Seeing Structure in Expressions' },
  { code: 'A-APR.A.1', description: 'Understand that polynomials form a system analogous to the integers', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Arithmetic with Polynomials and Rational Expressions' },
  { code: 'A-CED.A.1', description: 'Create equations and inequalities in one variable', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Creating Equations' },
  { code: 'A-CED.A.2', description: 'Create equations in two or more variables to represent relationships', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Creating Equations' },
  { code: 'A-REI.A.1', description: 'Explain each step in solving a simple equation', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Reasoning with Equations and Inequalities' },
  { code: 'A-REI.B.3', description: 'Solve linear equations and inequalities in one variable', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Reasoning with Equations and Inequalities' },
  { code: 'A-REI.B.4', description: 'Solve quadratic equations in one variable', subject: 'Math', gradeLevel: '9-12', domain: 'Algebra - Reasoning with Equations and Inequalities' },
  
  // High School Functions
  { code: 'F-IF.A.1', description: 'Understand that a function from one set assigns to each element', subject: 'Math', gradeLevel: '9-12', domain: 'Functions - Interpreting Functions' },
  { code: 'F-IF.A.2', description: 'Use function notation, evaluate functions for inputs', subject: 'Math', gradeLevel: '9-12', domain: 'Functions - Interpreting Functions' },
  { code: 'F-IF.B.4', description: 'For a function that models a relationship between two quantities', subject: 'Math', gradeLevel: '9-12', domain: 'Functions - Interpreting Functions' },
  { code: 'F-BF.A.1', description: 'Write a function that describes a relationship between two quantities', subject: 'Math', gradeLevel: '9-12', domain: 'Functions - Building Functions' },
  { code: 'F-BF.B.3', description: 'Identify the effect on the graph of replacing f(x) by f(x) + k', subject: 'Math', gradeLevel: '9-12', domain: 'Functions - Building Functions' },
  
  // High School Geometry
  { code: 'G-CO.A.1', description: 'Know precise definitions of angle, circle, perpendicular line', subject: 'Math', gradeLevel: '9-12', domain: 'Geometry - Congruence' },
  { code: 'G-CO.B.6', description: 'Use geometric descriptions of rigid motions to transform figures', subject: 'Math', gradeLevel: '9-12', domain: 'Geometry - Congruence' },
  { code: 'G-SRT.A.1', description: 'Verify experimentally the properties of dilations', subject: 'Math', gradeLevel: '9-12', domain: 'Geometry - Similarity, Right Triangles, and Trigonometry' },
  { code: 'G-GPE.A.1', description: 'Derive the equation of a circle of given center and radius', subject: 'Math', gradeLevel: '9-12', domain: 'Geometry - Expressing Geometric Properties with Equations' },
  
  // High School Statistics
  { code: 'S-ID.A.1', description: 'Represent data with plots on the real number line', subject: 'Math', gradeLevel: '9-12', domain: 'Statistics - Interpreting Categorical and Quantitative Data' },
  { code: 'S-ID.B.6', description: 'Represent data on two quantitative variables on a scatter plot', subject: 'Math', gradeLevel: '9-12', domain: 'Statistics - Interpreting Categorical and Quantitative Data' },
  { code: 'S-IC.A.1', description: 'Understand statistics as a process for making inferences', subject: 'Math', gradeLevel: '9-12', domain: 'Statistics - Making Inferences and Justifying Conclusions' },
];

export const COMMON_CORE_ELA_STANDARDS: CommonCoreStandard[] = [
  // Reading Literature
  { code: 'RL.K.1', description: 'With prompting and support, ask and answer questions about key details', subject: 'ELA', gradeLevel: 'K', domain: 'Reading Literature' },
  { code: 'RL.1.1', description: 'Ask and answer questions about key details in a text', subject: 'ELA', gradeLevel: '1', domain: 'Reading Literature' },
  { code: 'RL.2.1', description: 'Ask and answer such questions as who, what, where, when, why', subject: 'ELA', gradeLevel: '2', domain: 'Reading Literature' },
  { code: 'RL.3.1', description: 'Ask and answer questions to demonstrate understanding of a text', subject: 'ELA', gradeLevel: '3', domain: 'Reading Literature' },
  { code: 'RL.4.1', description: 'Refer to details and examples in a text when explaining what the text says', subject: 'ELA', gradeLevel: '4', domain: 'Reading Literature' },
  { code: 'RL.5.1', description: 'Quote accurately from a text when explaining what the text says', subject: 'ELA', gradeLevel: '5', domain: 'Reading Literature' },
  
  // Reading Informational Text
  { code: 'RI.K.1', description: 'With prompting and support, ask and answer questions about key details', subject: 'ELA', gradeLevel: 'K', domain: 'Reading Informational Text' },
  { code: 'RI.1.1', description: 'Ask and answer questions about key details in a text', subject: 'ELA', gradeLevel: '1', domain: 'Reading Informational Text' },
  { code: 'RI.2.1', description: 'Ask and answer such questions as who, what, where, when, why', subject: 'ELA', gradeLevel: '2', domain: 'Reading Informational Text' },
  
  // Writing
  { code: 'W.K.1', description: 'Use a combination of drawing, dictating, and writing to compose opinion pieces', subject: 'ELA', gradeLevel: 'K', domain: 'Writing' },
  { code: 'W.1.1', description: 'Write opinion pieces in which they introduce the topic or name the book', subject: 'ELA', gradeLevel: '1', domain: 'Writing' },
  { code: 'W.2.1', description: 'Write opinion pieces in which they introduce the topic or book', subject: 'ELA', gradeLevel: '2', domain: 'Writing' },
  
  // Speaking and Listening
  { code: 'SL.K.1', description: 'Participate in collaborative conversations with diverse partners', subject: 'ELA', gradeLevel: 'K', domain: 'Speaking and Listening' },
  { code: 'SL.1.1', description: 'Participate in collaborative conversations with diverse partners', subject: 'ELA', gradeLevel: '1', domain: 'Speaking and Listening' },
  
  // Language
  { code: 'L.K.1', description: 'Demonstrate command of the conventions of standard English grammar', subject: 'ELA', gradeLevel: 'K', domain: 'Language' },
  { code: 'L.1.1', description: 'Demonstrate command of the conventions of standard English grammar', subject: 'ELA', gradeLevel: '1', domain: 'Language' },
];

// Combine all standards
export const ALL_COMMON_CORE_STANDARDS = [
  ...COMMON_CORE_MATH_STANDARDS,
  ...COMMON_CORE_ELA_STANDARDS
];

// Validation functions
export function isValidCommonCoreStandard(code: string): boolean {
  return ALL_COMMON_CORE_STANDARDS.some(standard => 
    standard.code.toLowerCase() === code.toLowerCase()
  );
}

export function findCommonCoreStandard(code: string): CommonCoreStandard | undefined {
  return ALL_COMMON_CORE_STANDARDS.find(standard => 
    standard.code.toLowerCase() === code.toLowerCase()
  );
}

export function suggestSimilarStandards(input: string, limit: number = 5): CommonCoreStandard[] {
  const inputLower = input.toLowerCase();
  
  // First try exact matches
  const exactMatches = ALL_COMMON_CORE_STANDARDS.filter(standard =>
    standard.code.toLowerCase().includes(inputLower)
  );
  
  if (exactMatches.length > 0) {
    return exactMatches.slice(0, limit);
  }
  
  // Then try partial matches in description
  const descriptionMatches = ALL_COMMON_CORE_STANDARDS.filter(standard =>
    standard.description.toLowerCase().includes(inputLower)
  );
  
  return descriptionMatches.slice(0, limit);
}

export function validateStandardsList(codes: string[]): {
  valid: CommonCoreStandard[];
  invalid: string[];
  suggestions: { [key: string]: CommonCoreStandard[] };
} {
  const valid: CommonCoreStandard[] = [];
  const invalid: string[] = [];
  const suggestions: { [key: string]: CommonCoreStandard[] } = {};
  
  for (const code of codes) {
    const trimmedCode = code.trim();
    if (!trimmedCode) continue;
    
    const standard = findCommonCoreStandard(trimmedCode);
    if (standard) {
      valid.push(standard);
    } else {
      invalid.push(trimmedCode);
      suggestions[trimmedCode] = suggestSimilarStandards(trimmedCode, 3);
    }
  }
  
  return { valid, invalid, suggestions };
}