import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { RecommendService } from './recommend.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('recommend')
@Controller('recommend')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class RecommendController {
  constructor(private readonly recommendService: RecommendService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get recommended users for friend connection' })
  @ApiQuery({
    name: 'k',
    required: false,
    description: 'Number of recommendations',
    type: Number,
  })
  @ApiQuery({
    name: 'window_days',
    required: false,
    description: 'Time window in days',
    type: Number,
  })
  @ApiQuery({
    name: 'neighbor_k',
    required: false,
    description: 'Number of neighbors to consider',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response with user recommendations',
  })
  async getRecommendUsers(
    @Req() req: any,
    @Query('k') k?: number,
    @Query('window_days') windowDays?: number,
    @Query('neighbor_k') neighborK?: number,
  ) {
    const userId = req.user.userId;
    // Calling the recommendation service with specified parameters
    return this.recommendService.getRecommendUsers(userId, {
      k: k ? Number(k) : 40,
      window_days: windowDays ? Number(windowDays) : 30,
      neighbor_k: neighborK ? Number(neighborK) : 100,
    });
  }
}
