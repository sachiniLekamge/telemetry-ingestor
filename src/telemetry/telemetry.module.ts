import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { RedisService } from './redis.service';
import { AlertService } from './alert.service';
import { Telemetry, TelemetrySchema } from './schemas/telemetry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Telemetry.name, schema: TelemetrySchema },
    ]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [TelemetryController],
  providers: [TelemetryService, RedisService, AlertService],
})
export class TelemetryModule {}
