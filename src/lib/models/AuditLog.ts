import { model, models, Schema } from 'mongoose';

const auditLogSchema = new Schema({
  actorId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  detail: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'auditlogs' });

export const AuditLog = models.AuditLog ?? model('AuditLog', auditLogSchema);
