const mongoose = require('mongoose');
const { Schema } = mongoose;

const ModelArtifactSchema = new Schema({
  name: { type: String, required: true },
  version: { type: String, required: true },
  path: { type: String, required: true },
  size_bytes: { type: Number, required: true },
  hashes: { type: Schema.Types.Mixed },
  license_id: { type: Schema.Types.ObjectId, ref: 'License' },
  tags: { type: [String], default: [] }
}, { timestamps: true });

ModelArtifactSchema.index({ name: 1, version: 1 }, { unique: true });

module.exports = mongoose.models.ModelArtifact || mongoose.model('ModelArtifact', ModelArtifactSchema);
