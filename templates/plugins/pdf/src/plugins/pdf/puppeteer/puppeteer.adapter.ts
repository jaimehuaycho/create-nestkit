import { Injectable } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { PdfPort, PdfOptions } from '../pdf.port.js';
import { PdfGenerationException } from '../exceptions/index.js';

@Injectable()
export class PuppeteerAdapter extends PdfPort {
    private browser: Browser;

    async onModuleInit(): Promise<void> {
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });
    }

    async onModuleDestroy(): Promise<void> {
        await this.browser?.close();
    }

    async generate(html: string, options: PdfOptions = {}): Promise<Buffer> {
        const page = await this.browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'domcontentloaded' });
            const pdf = await page.pdf({
                format:          options.format          ?? 'Letter',
                printBackground: options.printBackground ?? true,
                margin:          options.margin,
            });
            return Buffer.from(pdf);
        } catch (err) {
            throw new PdfGenerationException(err.message);
        } finally {
            await page.close();
        }
    }
}
