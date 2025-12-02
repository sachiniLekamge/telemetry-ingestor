import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryDto } from './dto/telemetry.dto';

@Controller('api/v1')
export class TelemetryController {
  private readonly logger = new Logger(TelemetryController.name);

  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('telemetry')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async ingestTelemetry(
    @Body() data: TelemetryDto | TelemetryDto[],
  ): Promise<{ message: string; count: number }> {
    const count = Array.isArray(data) ? data.length : 1;
    this.logger.log(`Received ${count} telemetry reading(s)`);

    await this.telemetryService.ingestTelemetry(data);

    return {
      message: 'Telemetry ingested successfully',
      count,
    };
  }

  @Get('devices/:deviceId/latest')
  async getLatest(@Param('deviceId') deviceId: string): Promise<any> {
    this.logger.log(`Fetching latest data for device ${deviceId}`);

    const latest = await this.telemetryService.getLatest(deviceId);

    if (!latest) {
      throw new NotFoundException(`No data found for device ${deviceId}`);
    }

    return latest;
  }
}
