export interface OcrField {
  key: string;
  value: string;
  confidence: number;
}

export interface OcrProvider {
  extract(fileUrl: string, fileType: string): Promise<{ fields: OcrField[] }>;
}

export class MockOcrProvider implements OcrProvider {
  async extract(fileUrl: string, fileType: string): Promise<{ fields: OcrField[] }> {
    return {
      fields: [
        { key: "companyName", value: "Acme Corp", confidence: 0.95 },
        { key: "cin", value: "L12345MH2023PTC123456", confidence: 0.98 },
        { key: "incorporationDate", value: "2023-01-15", confidence: 0.85 },
      ],
    };
  }
}
