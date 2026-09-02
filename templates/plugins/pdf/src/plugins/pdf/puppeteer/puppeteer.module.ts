import { Module } from '@nestjs/common';
import { PuppeteerAdapter } from './puppeteer.adapter.js';
import { PdfPort } from '../pdf.port.js';

@Module({
    providers: [
        PuppeteerAdapter,
        { provide: PdfPort, useExisting: PuppeteerAdapter },
    ],
    exports: [PdfPort],
})
export class PuppeteerModule {}
