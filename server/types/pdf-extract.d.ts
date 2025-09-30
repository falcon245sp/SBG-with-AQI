declare module 'pdf-extract' {
  interface PDFExtractOptions {
    [key: string]: any;
  }

  interface PDFExtractCallback {
    (err: Error | null, data: any): void;
  }

  class PDFExtract {
    extract(filePath: string, options: PDFExtractOptions, callback: PDFExtractCallback): void;
  }

  export = PDFExtract;
}