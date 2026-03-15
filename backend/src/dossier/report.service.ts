import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import * as handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import { Dossier } from '@prisma/client';

@Injectable()
export class ReportService {
    private readonly logger = new Logger(ReportService.name);

    constructor(private storageService: StorageService) {
        this.registerHelpers();
    }

    private registerHelpers() {
        handlebars.registerHelper('json', (context) => JSON.stringify(context, null, 2));
        handlebars.registerHelper('formatDate', (date) => new Date(date).toLocaleString());
    }

    async generateHtmlReport(dossier: any): Promise<string> {
        const templateSource = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 20px; }
                    h1 { color: #1a202c; border-bottom: 2px solid #edf2f7; padding-bottom: 10px; }
                    h2 { color: #2d3748; margin-top: 30px; }
                    .section { margin-bottom: 40px; }
                    .summary { background: #f7fafc; padding: 20px; border-left: 4px solid #4a5568; }
                    .risk-high { color: #e53e3e; font-weight: bold; }
                    .risk-medium { color: #dd6b20; font-weight: bold; }
                    .risk-low { color: #38a169; font-weight: bold; }
                    pre { background: #edf2f7; padding: 10px; border-radius: 5px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h1>Intelligence Dossier: {{subject}}</h1>
                <p>Generated on: {{formatDate createdAt}}</p>

                <div class="section">
                    <h2>Executive Summary</h2>
                    <div class="summary">
                        {{{content.summary}}}
                    </div>
                </div>

                <div class="section">
                    <h2>Risk Assessment</h2>
                    <p>Risk Level: <span class="risk-{{content.riskAssessment.riskLevel.toLowerCase}}">{{content.riskAssessment.riskLevel}}</span></p>
                    <p>{{content.riskAssessment.explanation}}</p>
                    <ul>
                        {{#each content.riskAssessment.findings}}
                            <li>{{this}}</li>
                        {{/each}}
                    </ul>
                </div>

                <div class="section">
                    <h2>Identified Relationships</h2>
                    <ul>
                        {{#each content.relationships.links}}
                            <li>{{this.source}} -> {{this.target}} ({{this.type}})</li>
                        {{/each}}
                    </ul>
                </div>

                <div class="section">
                    <h2>Intelligence Insights</h2>
                    <pre>{{json content.aiInsights}}</pre>
                </div>
            </body>
            </html>
        `;

        const template = handlebars.compile(templateSource);
        return template(dossier);
    }

    async generatePdfReport(dossier: any): Promise<string> {
        this.logger.log(`Generating PDF report for dossier: ${dossier.id}`);
        const html = await this.generateHtmlReport(dossier);

        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setContent(html);
        const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } });
        await browser.close();

        const fileName = `reports/dossier_${dossier.id}_${Date.now()}.pdf`;
        return this.storageService.uploadFile(fileName, Buffer.from(pdfBuffer), 'application/pdf');
    }

    async generateJsonReport(dossier: any): Promise<string> {
        const fileName = `reports/dossier_${dossier.id}_${Date.now()}.json`;
        return this.storageService.uploadFile(fileName, JSON.stringify(dossier, null, 2), 'application/json');
    }
}
