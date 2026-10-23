import { model, models, Schema } from 'mongoose';

const savedExperimentSchema = new Schema(
  {
    owner: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    schemaVersion: { type: Number, required: true, enum: [1] },
    data: { type: Schema.Types.Mixed, required: true },
    visibility: { type: String, enum: ['private', 'unlisted', 'public'], default: 'private', required: true },
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
      // No default: private experiments must not carry a share token. The API mints one when visibility becomes unlisted/public.
    },
  },
  { timestamps: true, collection: 'savedexperiments' },
);

savedExperimentSchema.index({ owner: 1, createdAt: -1 });
savedExperimentSchema.index({ visibility: 1, createdAt: -1 });
savedExperimentSchema.index({ shareToken: 1 }, { unique: true, sparse: true });

export const SavedExperiment = models.SavedExperiment ?? model('SavedExperiment', savedExperimentSchema);
