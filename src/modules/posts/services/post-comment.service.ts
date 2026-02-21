import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostCommentRepository } from '../repositories/post-comment.repository';
import { PostRepository } from 'src/modules/posts/repositories/post.repository';
import { PrismaService } from 'src/prisma/prisma.service';



@Injectable()
export class PostCommentService {
  constructor(
    private readonly postCommentRepository: PostCommentRepository,
    private readonly postRepository: PostRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createComment(data: {
    userId: string;
    postId: string;
    content: string;
    parentId?: string;
  }) {
    const { userId, postId, content, parentId } = data;

    // Check depth if replying
    let depth = 0;
    if (parentId) {
      const parentComment = await this.postCommentRepository.findById(parentId);
      if (parentComment) {
        depth = parentComment.depth + 1;
      }
    }

    const comment = await this.postCommentRepository.create({
      user_id: BigInt(userId),
      post_id: BigInt(postId),
      content,
      parent_id: parentId ? BigInt(parentId) : null,
      depth,
    });

    // Update post comment count
    await this.postRepository.incrementCommentCount(postId);

    const responseData = {
      success: true,
      message: 'Comment created successfully',
      data: {
        id: comment.id.toString(),
        post_id: comment.post_id.toString(),
        user_id: comment.user_id.toString(),
        content: comment.content,
        parent_id: comment.parent_id ? comment.parent_id.toString() : null,
        depth: comment.depth,
        created_at: comment.created_at,
        user: {
          id: comment.users.id.toString(),
          username: comment.users.username,
          name: comment.users.name,
          avatar_url: comment.users.avatar_url,
        },
      },
    };



    return responseData;
  }

  async getPostComments(postId: string, page = 1, limit = 10) {
    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const skip = (pageNumber - 1) * limitNumber;

    const [comments, total] = await Promise.all([
      this.postCommentRepository.findByPostId(postId, skip, limitNumber),
      this.postCommentRepository.countByPostId(postId),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    const formatComment = (comment: any) => ({
      id: comment.id.toString(),
      post_id: comment.post_id.toString(),
      user_id: comment.user_id.toString(),
      content: comment.content,
      parent_id: comment.parent_id ? comment.parent_id.toString() : null,
      depth: comment.depth,
      created_at: comment.created_at,
      user: {
        id: comment.users.id.toString(),
        username: comment.users.username,
        name: comment.users.name,
        avatar_url: comment.users.avatar_url,
      },
      replies: [], // Root comments fetched initially have no replies loaded
      has_replies: (comment as any)._count?.replies > 0,
    });

    return {
      success: true,
      message: 'Get comments successfully',
      data: {
        items: comments.map(formatComment),
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
        },
      },
    };
  }

  async getCommentReplies(parentId: string, page = 1, limit = 10) {
    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    const skip = (pageNumber - 1) * limitNumber;

    const [comments, total] = await Promise.all([
      this.postCommentRepository.findByParentId(
        parentId,
        skip,
        limitNumber,
      ),
      this.postCommentRepository.countByParentId(parentId),
    ]);

    const totalPages = Math.ceil(total / limitNumber);

    const formatComment = (comment: any) => ({
      id: comment.id.toString(),
      post_id: comment.post_id.toString(),
      user_id: comment.user_id.toString(),
      content: comment.content,
      parent_id: comment.parent_id ? comment.parent_id.toString() : null,
      depth: comment.depth,
      created_at: comment.created_at,
      user: {
        id: comment.users.id.toString(),
        username: comment.users.username,
        name: comment.users.name,
        avatar_url: comment.users.avatar_url,
      },
      replies: [], // Root comments fetched initially have no replies loaded
      has_replies: (comment as any)._count?.replies > 0,
    });

    return {
      success: true,
      message: 'Get replies successfully',
      data: {
        items: comments.map(formatComment),
        pagination: {
          total,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
        },
      },
    };
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.postCommentRepository.findById(commentId);

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if the user is the owner of the comment
    if (comment.user_id !== BigInt(userId)) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.postCommentRepository.delete(commentId, tx);
      await this.postRepository.decrementCommentCount(comment.post_id, tx);
    });

    return {
      success: true,
      message: 'Comment deleted successfully',
    };
  }
}


