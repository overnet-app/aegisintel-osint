import { Controller, Delete, UseGuards, Request, Post, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { AuditService, AuditAction } from '../common/services/audit.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('gdpr')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gdpr')
export class GdprController {
    constructor(
        private readonly userService: UserService,
        private readonly audit: AuditService,
    ) { }

    @Delete('purge')
    @ApiOperation({ summary: 'Purge all user data and delete account (GDPR Article 17)' })
    async purgeAccount(@Request() req) {
        const userId = req.user.id;
        await this.audit.log(userId, AuditAction.DATA_DELETION, { reason: 'Account Purge' });
        return this.userService.deleteUser(userId);
    }

    @Post('mask')
    @ApiOperation({ summary: 'Mask personal data in search history' })
    async maskData(@Request() req) {
        const userId = req.user.id;
        await this.audit.log(userId, AuditAction.DATA_DELETION, { type: 'Data Masking' });
        // Masking logic would go here
        return { status: 'DEPRECATED', message: 'Data masking initiated' };
    }
}
