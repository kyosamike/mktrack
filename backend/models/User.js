const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['administrator', 'officer', 'resident'], default: 'resident' },
  community: { type: String, enum: ['Bugema', 'Busiika', 'Namulonge', 'Kiwenda', 'Kiziri'], default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
