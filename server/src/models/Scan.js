import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
  input: { type: String, required: true, maxlength: 12000 },
  sourceType: { type: String, enum: ['article', 'headline', 'url'], default: 'article' },
  language: { type: String, enum: ['auto', 'en', 'te', 'hi', 'ur', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'mixed'], default: 'en' },
  analysisVersion: { type: Number, default: 5 },
  claimType: { type: String, enum: ['Fact', 'Opinion'], default: 'Fact' },
  classification: { type: String, default: 'Insufficient' },
  verdict: { type: String, default: 'Needs review' },
  displayVerdict: { type: String, default: 'INSUFFICIENT EVIDENCE' },
  confidence: { type: Number, min: 0, max: 100, default: 50 },
  claim: { type: String, default: '' },
  summary: { type: String, default: '' },
  explanation: { type: String, default: '' },
  reasoningSummary: { type: String, default: '' },
  keyClaims: [{ type: String }],
  supportingEvidence: [{ type: String }],
  contradictingEvidence: [{ type: String }],
  conflictingReports: { type: Boolean, default: false },
  conflictingDetails: { type: String, default: '' },
  eventDate: { type: String, default: '' },
  articleDate: { type: String, default: '' },
  currentness: { type: String, default: 'Unknown' },
  dateWarning: { type: String, default: '' },
  sources: [{
    name: { type: String, default: '' },
    title: { type: String, default: '' },
    url: { type: String, default: '' },
    published: { type: String, default: '' },
    domain: { type: String, default: '' }
  }],
  verifiedAt: { type: Date, default: Date.now },
  signals: [{ type: String }],
  evidence: [{
    point: { type: String, default: '' },
    support: { type: String, default: '' },
    limitation: { type: String, default: '' }
  }]
}, { timestamps: true });

export default mongoose.model('Scan', scanSchema);
