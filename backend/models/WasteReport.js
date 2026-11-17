const mongoose = require('mongoose');

const wasteReportSchema = new mongoose.Schema({
  residentName: { type: String, required: true, trim: true, maxlength: 100 },
  community: { type: String, required: true, enum: ['Bugema', 'Busiika', 'Namulonge', 'Kiwenda', 'Kiziri'] },
  wasteType: { type: String, required: true, enum: ['Organic', 'Plastic', 'Paper', 'Metal', 'General', 'Electronic'] },
  quantity: { type: Number, required: true, min: 0.1 },
  unit: { type: String, enum: ['kg', 'bags', 'bins'], default: 'kg' },
  location: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  collectionDate: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'In Progress', 'Collected'], default: 'Pending' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  photoUrl: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('WasteReport', wasteReportSchema);
