import { model, models, Schema } from 'mongoose';

const moderationRecordSchema = new Schema({
  experimentId: { type: Schema.Types.ObjectId, ref: 'SavedExperiment', required: true, index: true },
  shareToken: { type: String, required: true },
  reporterId: { type: String, default: null },
  reason: { type: String, enum: ['spam', 'abuse', 'misinformation', 'copyright', 'other'], required: true },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending', required: true },
}, { timestamps: true, collection: 'moderationrecords' });

export const ModerationRecord = models.ModerationRecord ?? model('ModerationRecord', moderationRecordSchema);
