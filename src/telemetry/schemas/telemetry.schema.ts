import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TelemetryDocument = Telemetry & Document;

@Schema({ timestamps: true })
export class Telemetry {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true, type: Date, index: true })
  ts: Date;

  @Prop({
    required: true,
    type: {
      temperature: { type: Number, required: true },
      humidity: { type: Number, required: true },
    },
  })
  metrics: {
    temperature: number;
    humidity: number;
  };
}

export const TelemetrySchema = SchemaFactory.createForClass(Telemetry);

TelemetrySchema.index({ siteId: 1, ts: -1 });
TelemetrySchema.index({ deviceId: 1, ts: -1 });
