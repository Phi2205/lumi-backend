import { Injectable } from '@nestjs/common';
import { PostMediaRepository } from '../repositories/post-media.repository';

@Injectable()
export class PostMediaService {
  constructor(private readonly postMediaRepository: PostMediaRepository) {}
  
  // Future logic for media processing can go here.
}
