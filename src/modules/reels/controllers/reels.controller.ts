import {
    Controller,
    Post,
    Body,
    UseGuards,
    Req,
    Get,
    Query,
    Param,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiConsumes,
    ApiBearerAuth,
    ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReelsService } from '../services/reels.service';
import { CreateReelDto } from '../dto/create-reel.dto';
import { ReelLikeService } from '../services/reel-like.service';

@ApiTags('reels')
@Controller('reels')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class ReelsController {
    constructor(
        private readonly reelsService: ReelsService,
        private readonly reelLikeService: ReelLikeService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new reel' })
    @ApiConsumes('application/json')
    async createReel(
        @Body() dto: CreateReelDto,
        @Req() req: any,
    ) {
        const result = await this.reelsService.createReel(
            req.user.userId,
            dto.video_url,
            dto.public_id,
            dto,
        );

        return {
            success: true,
            message: 'Reel created successfully',
            data: result,
        };
    }

    @Get('me')
    @ApiOperation({ summary: 'Get my reels with cursor pagination' })
    async getMyReels(
        @Req() req: any,
        @Query('cursor') cursor?: string,
        @Query('limit') limit?: string,
    ) {
        const userId = req.user.userId;
        const result = await this.reelsService.getUserReels(
            userId,
            cursor,
            limit ? parseInt(limit) : 10,
        );

        return {
            success: true,
            message: 'My reels fetched successfully',
            data: result,
        };
    }

    @Get()
    @ApiOperation({ summary: 'Get list of reels' })
    async getReels(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const result = await this.reelsService.getReels(
            req.user.userId,
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 10,
        );

        return {
            success: true,
            message: 'Reels fetched successfully',
            data: result,
        };
    }

    @Get('user/:userId')
    @ApiOperation({ summary: 'Get user reels by userId with cursor pagination' })
    async getUserReels(
        @Req() req: any,
        @Param('userId') userId: string,
        @Query('cursor') cursor?: string,
        @Query('limit') limit?: string,
    ) {
        const viewerId = req.user.userId;
        const result = await this.reelsService.getUserReels(
            userId,
            cursor,
            limit ? parseInt(limit) : 10,
            viewerId,
        );

        return {
            success: true,
            message: 'User reels fetched successfully',
            data: result,
        };
    }

    @Post(':id/like')
    @ApiOperation({ summary: 'Toggle like a reel' })
    @ApiResponse({ status: 200, description: 'Reel liked/unliked successfully' })
    async toggleLike(@Param('id') id: string, @Req() req: any) {
        const userId = req.user.userId;
        return this.reelLikeService.toggleLike(id, userId);
    }

    @Get(':id/likes')
    @ApiOperation({ summary: 'Get all likes for a reel' })
    @ApiResponse({ status: 200, description: 'List of users who liked the reel' })
    async getLikesByReelId(
        @Param('id') id: string,
        @Query('cursor') cursor?: string,
        @Query('limit') limit?: string,
    ) {
        return this.reelLikeService.getLikesByReelId(id, cursor, limit ? parseInt(limit) : 20);
    }
}
