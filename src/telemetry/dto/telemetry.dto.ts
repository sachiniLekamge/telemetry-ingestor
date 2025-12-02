import {
  IsString,
  IsNotEmpty,
  IsISO8601,
  IsNumber,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MetricsDto {
  @IsNumber()
  @Min(-100)
  @Max(200)
  temperature: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  humidity: number;
}

export class TelemetryDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  siteId: string;

  @IsISO8601()
  @IsNotEmpty()
  ts: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => MetricsDto)
  metrics: MetricsDto;
}

export class TelemetryArrayDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TelemetryDto)
  @IsDefined({ each: true })
  data: TelemetryDto[];
}

export class SiteSummaryQueryDto {
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;
}

export class AlertDto {
  deviceId: string;
  siteId: string;
  ts: string;
  reason: 'HIGH_TEMPERATURE' | 'HIGH_HUMIDITY';
  value: number;
}
