import { IsNotEmpty, IsString } from 'class-validator';

export class SendFriendRequestDto {
  @IsNotEmpty()
  @IsString()
  receiver_id: string;
}
