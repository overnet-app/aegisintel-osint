import { Injectable, Logger } from '@nestjs/common';
import * as exifParser from 'exif-parser';
import { fileTypeFromBuffer } from 'file-type';

export interface ExifMetadata {
    gps?: {
        latitude: number;
        longitude: number;
    };
    camera?: {
        make?: string;
        model?: string;
    };
    dateTaken?: Date;
    software?: string;
    orientation?: number;
    width?: number;
    height?: number;
}

@Injectable()
export class ExifService {
    private readonly logger = new Logger(ExifService.name);

    async extractMetadata(imageBuffer: Buffer): Promise<ExifMetadata | null> {
        try {
            // Verify it's an image
            const fileType = await fileTypeFromBuffer(imageBuffer);
            if (!fileType || !fileType.mime.startsWith('image/')) {
                this.logger.warn('Buffer is not a valid image file');
                return null;
            }

            // Parse EXIF data
            const parser = exifParser.create(imageBuffer);
            const result = parser.parse();

            if (!result || !result.tags) {
                this.logger.debug('No EXIF data found in image');
                return null;
            }

            const metadata: ExifMetadata = {};

            // Extract GPS coordinates
            if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
                metadata.gps = {
                    latitude: result.tags.GPSLatitude,
                    longitude: result.tags.GPSLongitude,
                };
            }

            // Extract camera info
            if (result.tags.Make || result.tags.Model) {
                metadata.camera = {
                    make: result.tags.Make,
                    model: result.tags.Model,
                };
            }

            // Extract date taken
            if (result.tags.DateTimeOriginal) {
                metadata.dateTaken = new Date(result.tags.DateTimeOriginal * 1000);
            } else if (result.tags.DateTime) {
                metadata.dateTaken = new Date(result.tags.DateTime * 1000);
            }

            // Extract software
            if (result.tags.Software) {
                metadata.software = result.tags.Software;
            }

            // Extract orientation
            if (result.tags.Orientation) {
                metadata.orientation = result.tags.Orientation;
            }

            // Extract dimensions
            if (result.imageSize) {
                metadata.width = result.imageSize.width;
                metadata.height = result.imageSize.height;
            }

            this.logger.log(`Extracted EXIF metadata: ${JSON.stringify(metadata)}`);
            return metadata;
        } catch (error) {
            this.logger.warn(`Failed to extract EXIF metadata: ${error.message}`);
            return null;
        }
    }
}
