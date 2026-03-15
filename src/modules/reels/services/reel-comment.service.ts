import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReelCommentRepository } from '../repositories/reel-comment.repository';
import { ReelsRepository } from '../repositories/reels.repository';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReelCommentService {
    constructor(
        private readonly reelCommentRepository: ReelCommentRepository,
        private readonly reelsRepository: ReelsRepository,
        private readonly prisma: PrismaService,
    ) { }

    async createComment(data: {
        userId: string;
        reelId: string;
        content: string;
        parentId?: string;
    }) {
        const { userId, reelId, content, parentId } = data;

        // Check depth if replying
        let depth = 0;
        if (parentId) {
            const parentComment = await this.reelCommentRepository.findById(parentId);
            if (parentComment) {
                depth = parentComment.depth + 1;
            }
        }

        const comment = await this.reelCommentRepository.create({
            user_id: BigInt(userId),
            reel_id: BigInt(reelId),
            content,
            parent_id: parentId ? BigInt(parentId) : null,
            depth,
        });

        // Update reel comment count
        await this.reelsRepository.incrementCommentCount(reelId);

        const responseData = {
            success: true,
            message: 'Comment created successfully',
            data: {
                id: comment.id.toString(),
                reel_id: comment.reel_id.toString(),
                user_id: comment.user_id.toString(),
                content: comment.content,
                parent_id: comment.parent_id ? comment.parent_id.toString() : null,
                depth: comment.depth,
                created_at: comment.created_at,
                user: {
                    id: comment.user.id.toString(),
                    username: comment.user.username,
                    name: comment.user.name,
                    avatar_url: comment.user.avatar_url,
                },
            },
        };

        return responseData;
    }

    async getReelComments(reelId: string, cursor?: string, limit = 10) {
        const limitNumber = Number(limit);

        const skip = cursor ? 1 : 0;
        const cursorObj = cursor ? { id: BigInt(cursor) } : undefined;

        const [comments, total] = await Promise.all([
            this.reelCommentRepository.findByReelId(reelId, skip, limitNumber, cursorObj),
            this.reelCommentRepository.countByReelId(reelId),
        ]);

        const nextCursor =
            comments.length === limitNumber
                ? comments[comments.length - 1].id.toString()
                : null;

        const formatComment = (comment: any) => ({
            id: comment.id.toString(),
            reel_id: comment.reel_id.toString(),
            user_id: comment.user_id.toString(),
            content: comment.content,
            parent_id: comment.parent_id ? comment.parent_id.toString() : null,
            depth: comment.depth,
            created_at: comment.created_at,
            user: {
                id: comment.user.id.toString(),
                username: comment.user.username,
                name: comment.user.name,
                avatar_url: comment.user.avatar_url,
            },
            replies: [], // Root comments fetched initially have no replies loaded
            has_replies: (comment as any)._count?.replies > 0,
        });

        return {
            success: true,
            message: 'Get comments successfully',
            data: {
                items: comments.map(formatComment),
                total,
                limit: limitNumber,
                nextCursor,
                hasMore: comments.length === limitNumber,
            },
        };
    }

    async getCommentReplies(parentId: string, cursor?: string, limit = 10) {
        const limitNumber = Number(limit);

        const skip = cursor ? 1 : 0;
        const cursorObj = cursor ? { id: BigInt(cursor) } : undefined;

        const [comments, total] = await Promise.all([
            this.reelCommentRepository.findByParentId(
                parentId,
                skip,
                limitNumber,
                cursorObj,
            ),
            this.reelCommentRepository.countByParentId(parentId),
        ]);


        const nextCursor =
            comments.length === limitNumber
                ? comments[comments.length - 1].id.toString()
                : null;

        const formatComment = (comment: any) => ({
            id: comment.id.toString(),
            reel_id: comment.reel_id.toString(),
            user_id: comment.user_id.toString(),
            content: comment.content,
            parent_id: comment.parent_id ? comment.parent_id.toString() : null,
            depth: comment.depth,
            created_at: comment.created_at,
            user: {
                id: comment.user.id.toString(),
                username: comment.user.username,
                name: comment.user.name,
                avatar_url: comment.user.avatar_url,
            },
            replies: [], // Root comments fetched initially have no replies loaded
            has_replies: (comment as any)._count?.replies > 0,
        });

        return {
            success: true,
            message: 'Get replies successfully',
            data: {
                items: comments.map(formatComment),
                total,
                limit: limitNumber,
                nextCursor,
                hasMore: comments.length === limitNumber,
            },
        };
    }

    async deleteComment(commentId: string, userId: string) {
        const comment = await this.reelCommentRepository.findById(commentId);

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        // Check if the user is the owner of the comment
        if (comment.user_id !== BigInt(userId)) {
            throw new ForbiddenException('You can only delete your own comments');
        }

        await this.prisma.$transaction(async (tx) => {
            await this.reelCommentRepository.delete(commentId, tx);
            await this.reelsRepository.decrementCommentCount(comment.reel_id, tx);
        });

        return {
            success: true,
            message: 'Comment deleted successfully',
        };
    }
}
