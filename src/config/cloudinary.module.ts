import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configureCloudinary } from './cloudinary.config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'CLOUDINARY',
      useFactory: (configService: ConfigService) => {
        return configureCloudinary(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: ['CLOUDINARY'],
})
export class CloudinaryModule {}
