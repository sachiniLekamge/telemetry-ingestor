import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import { AlertDto } from './dto/telemetry.dto';
import { RedisService } from './redis.service';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly webhookUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private redisService: RedisService,
  ) {
    this.webhookUrl = this.configService.get<string>('ALERT_WEBHOOK_URL');
  }

  async checkAndSendAlert(
    deviceId: string,
    siteId: string,
    ts: string,
    metrics: { temperature: number; humidity: number },
  ): Promise<void> {
    const alerts: AlertDto[] = [];

    // Checking temperature threshold
    if (metrics.temperature > 50) {
      alerts.push({
        deviceId,
        siteId,
        ts,
        reason: 'HIGH_TEMPERATURE',
        value: metrics.temperature,
      });
    }

    // Checking humidity threshold
    if (metrics.humidity > 90) {
      alerts.push({
        deviceId,
        siteId,
        ts,
        reason: 'HIGH_HUMIDITY',
        value: metrics.humidity,
      });
    }

    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: AlertDto): Promise<void> {
    try {
      // Check deduplication (60s window)
      const shouldSend = await this.redisService.setAlertDedup(
        alert.deviceId,
        alert.reason,
      );

      if (!shouldSend) {
        this.logger.debug(
          `Alert deduplicated: ${alert.deviceId} - ${alert.reason}`,
        );
        return;
      }

      const response = await firstValueFrom(
        this.httpService
          .post(this.webhookUrl, alert, {
            headers: { 'Content-Type': 'application/json' },
          })
          .pipe(timeout(5000)),
      );

      this.logger.log(
        `Alert sent: ${alert.deviceId} - ${alert.reason} (${response.status})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send alert for ${alert.deviceId}: ${error.message}`,
      );
    }
  }
}
