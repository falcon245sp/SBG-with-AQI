#!/usr/bin/env python3
"""
Robust PDF text extraction using PDFMiner.
Usage: python extract_pdf_text.py <pdf_file_path>
"""

import sys
import json
from pdfminer.high_level import extract_text
from pdfminer.layout import LAParams
import logging

# Suppress PDFMiner debug logs
logging.getLogger('pdfminer').setLevel(logging.WARNING)

def extract_pdf_text(pdf_path):
    """Extract text from PDF using PDFMiner with optimized parameters."""
    try:
        # Configure layout analysis parameters for better text extraction
        laparams = LAParams(
            line_margin=0.5,     # Merge lines closer than this
            word_margin=0.1,     # Merge characters closer than this  
            char_margin=2.0,     # Character margin
            boxes_flow=0.5,      # Text flow detection
            all_texts=False      # Don't extract text from non-text elements
        )
        
        # Extract text with optimized parameters
        text = extract_text(pdf_path, laparams=laparams)
        
        if not text or not text.strip():
            return {
                "success": False,
                "error": "No text content found in PDF",
                "text": ""
            }
        
        # Clean up the extracted text
        cleaned_text = text.strip()
        
        return {
            "success": True,
            "text": cleaned_text,
            "length": len(cleaned_text),
            "error": None
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"PDF extraction failed: {str(e)}",
            "text": ""
        }

def main():
    if len(sys.argv) != 2:
        result = {
            "success": False,
            "error": "Usage: python extract_pdf_text.py <pdf_file_path>",
            "text": ""
        }
        print(json.dumps(result))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    result = extract_pdf_text(pdf_path)
    
    # Output JSON result to stdout
    print(json.dumps(result))
    
    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    main()