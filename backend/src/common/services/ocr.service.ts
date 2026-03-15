import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { PuppeteerClusterService } from '../../scraper/puppeteer-cluster.service';
import * as fs from 'fs';
import * as path from 'path';

export interface OCRResult {
    text: string;
    confidence: number;
    words?: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
}

@Injectable()
export class OcrService {
    private readonly logger = new Logger(OcrService.name);
    private worker: any = null;

    constructor(private puppeteer: PuppeteerClusterService) { }

    /**
     * Initialize Tesseract worker (lazy initialization)
     */
    private async getWorker() {
        if (!this.worker) {
            this.logger.log('Initializing Tesseract OCR worker...');
            this.worker = await createWorker('eng');
        }
        return this.worker;
    }

    /**
     * Extract text from an image buffer using OCR
     */
    async extractTextFromImage(imageBuffer: Buffer): Promise<OCRResult> {
        try {
            const worker = await this.getWorker();
            const result = await worker.recognize(imageBuffer);
            
            return {
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words?.map((w: any) => ({
                    text: w.text,
                    confidence: w.confidence,
                    bbox: w.bbox,
                })),
            };
        } catch (error) {
            this.logger.error(`OCR extraction failed: ${error.message}`);
            return { text: '', confidence: 0 };
        }
    }

    /**
     * Extract text from a PDF file using Puppeteer to render pages
     */
    async extractTextFromPdf(pdfBuffer: Buffer): Promise<OCRResult> {
        try {
            // Save PDF to temp file
            const tempPdfPath = path.join('/tmp', `pdf-ocr-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
            fs.writeFileSync(tempPdfPath, pdfBuffer);

            try {
                // Use Puppeteer to render PDF pages as images
                const allText: string[] = [];
                let totalConfidence = 0;
                let pageCount = 0;

                const result = await this.puppeteer.execute(async (page) => {
                    // Create a data URL from the PDF
                    const pdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
                    
                    // Load PDF in an iframe or object tag
                    await page.setContent(`
                        <html>
                            <body style="margin:0;padding:0;">
                                <embed src="${pdfDataUrl}" type="application/pdf" width="100%" height="100%" />
                            </body>
                        </html>
                    `, { waitUntil: 'networkidle2' });

                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Take screenshots of each page (simplified - just first page for now)
                    const screenshot = await page.screenshot({ type: 'png', fullPage: true });
                    return screenshot;
                });

                if (result) {
                    const ocrResult = await this.extractTextFromImage(result as Buffer);
                    if (ocrResult.text) {
                        allText.push(ocrResult.text);
                        totalConfidence = ocrResult.confidence;
                        pageCount = 1;
                    }
                }

                // Clean up temp file
                fs.unlinkSync(tempPdfPath);

                const avgConfidence = pageCount > 0 ? totalConfidence / pageCount : 0;

                return {
                    text: allText.join('\n\n'),
                    confidence: avgConfidence,
                };
            } catch (error) {
                // Clean up on error
                if (fs.existsSync(tempPdfPath)) {
                    fs.unlinkSync(tempPdfPath);
                }
                throw error;
            }
        } catch (error) {
            this.logger.error(`PDF OCR extraction failed: ${error.message}`);
            return { text: '', confidence: 0 };
        }
    }

    /**
     * Take a screenshot of a webpage and extract text via OCR
     */
    async extractTextFromUrl(url: string): Promise<OCRResult> {
        this.logger.log(`Extracting text from URL via OCR: ${url}`);

        return this.puppeteer.execute(async (page) => {
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for content

                // Take full page screenshot
                const screenshot = await page.screenshot({ 
                    type: 'png',
                    fullPage: true,
                });

                // Use OCR to extract text from screenshot
                // Note: We need to pass the buffer back to the service
                return screenshot;
            } catch (error) {
                this.logger.error(`Failed to screenshot page: ${error.message}`);
                return null;
            }
        }).then(async (screenshot) => {
            if (!screenshot) {
                return { text: '', confidence: 0 };
            }

            return this.extractTextFromImage(screenshot as Buffer);
        });
    }

    /**
     * Extract text from a file buffer (auto-detect type)
     */
    async extractTextFromBuffer(buffer: Buffer, mimeType?: string): Promise<OCRResult> {
        if (mimeType === 'application/pdf' || (!mimeType && buffer.slice(0, 4).toString() === '%PDF')) {
            return this.extractTextFromPdf(buffer);
        } else if (mimeType?.startsWith('image/') || !mimeType) {
            return this.extractTextFromImage(buffer);
        } else {
            this.logger.warn(`Unsupported file type for OCR: ${mimeType}`);
            return { text: '', confidence: 0 };
        }
    }

    /**
     * Cleanup worker on module destroy
     */
    async onModuleDestroy() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}
