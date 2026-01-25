import { IsNotEmpty, IsString } from 'class-validator';

export class RespondFriendRequestDto {
  @IsNotEmpty()
  @IsString()
  requester_id: string;
}
