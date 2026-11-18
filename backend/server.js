require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const WasteReport = require('./models/WasteReport');
const CollectionSchedule = require('./models/CollectionSchedule');
const Notification = require('./models/Notification');
const ActivityLog = require('./models/ActivityLog');
const CollectionTeam = require('./models/CollectionTeam');
const multer = require('multer');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
const COMMUNITIES = ['Bugema', 'Busiika', 'Namulonge', 'Kiwenda', 'Kiziri'];
const WASTE_TYPES = ['Organic', 'Plastic', 'Paper', 'Metal', 'General', 'Electronic'];
const STATUSES = ['Pending', 'In Progress', 'Collected'];

app.use(cors());
app.use(express.json({ limit: '1mb' }));
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '../frontend')));
const storage = multer.diskStorage({ destination: uploadDir, filename: (req,file,cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`) });
const imageUpload = multer({ storage, limits:{fileSize:5*1024*1024}, fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype)) });
async function logActivity(user, action, details='', community='') { try { await ActivityLog.create({actor:user?._id,actorName:user?.fullName||'System',action,details,community:user?.community||community}); } catch(e) { console.error('Activity log error:',e.message); } }
async function notifyUser(userId,title,message,link='') { if(userId) try { await Notification.create({user:userId,title,message,link}); } catch(e) { console.error('Notification error:',e.message); } }


const safeUser = user => ({
  id: String(user._id), fullName: user.fullName, email: user.email,
  role: user.role, community: user.community || '', active: user.active,
  createdAt: user.createdAt
});
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 100;

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Please sign in first.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}
async function loadUser(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.active) return res.status(401).json({ message: 'Your account is unavailable or disabled.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Could not verify your account.' });
  }
}
const permit = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission to do that.' });

function reportScope(user) {
  if (user.role === 'administrator') return {};
  if (user.role === 'officer') return { community: user.community };
  return { submittedBy: user._id };
}
function safeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
}

app.get('/api/health', (req, res) => res.json({ ok: true, message: 'API is running.' }));
app.get('/api/communities', (req, res) => res.json(COMMUNITIES));

app.post('/api/auth/setup-admin', async (req, res) => {
  try {
    const { setupKey, fullName, email, password } = req.body;
    if (!process.env.SETUP_KEY || setupKey !== process.env.SETUP_KEY)
      return res.status(403).json({ message: 'The administrator setup key is incorrect.' });
    if (await User.exists({ role: 'administrator' }))
      return res.status(409).json({ message: 'An administrator already exists. Sign in instead.' });
    if (!String(fullName || '').trim() || !validEmail(email) || !validPassword(password))
      return res.status(400).json({ message: 'Enter a name, valid email and password of at least 8 characters.' });
    const user = await User.create({
      fullName: String(fullName).trim(), email: String(email).trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12), role: 'administrator'
    });
    res.status(201).json({ message: 'Administrator created. You can now sign in.', user: safeUser(user) });
  } catch (err) {
    res.status(400).json({ message: err.code === 11000 ? 'That email is already registered.' : 'Could not create administrator.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password, community } = req.body;
    if (!String(fullName || '').trim() || !validEmail(email) || !validPassword(password) || !COMMUNITIES.includes(community))
      return res.status(400).json({ message: 'Complete all fields. Password must have at least 8 characters.' });
    const user = await User.create({
      fullName: String(fullName).trim(), email: String(email).trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12), role: 'resident', community
    });
    res.status(201).json({ message: 'Resident account created. Please sign in.', user: safeUser(user) });
  } catch (err) {
    res.status(400).json({ message: err.code === 11000 ? 'That email is already registered.' : 'Could not register this account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ message: 'Incorrect email or password.' });
    const token = jwt.sign({ id: String(user._id) }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: safeUser(user) });
  } catch {
    res.status(500).json({ message: 'Sign in failed. Please try again.' });
  }
});
app.get('/api/auth/me', auth, loadUser, (req, res) => res.json({ user: safeUser(req.user) }));

app.get('/api/users', auth, loadUser, permit('administrator'), async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map(safeUser));
});
app.post('/api/users/officers', auth, loadUser, permit('administrator'), async (req, res) => {
  try {
    const { fullName, email, password, community } = req.body;
    if (!String(fullName || '').trim() || !validEmail(email) || !validPassword(password) || !COMMUNITIES.includes(community))
      return res.status(400).json({ message: 'Enter a name, valid email, password of at least 8 characters and community.' });
    const user = await User.create({
      fullName: String(fullName).trim(), email: String(email).trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12), role: 'officer', community
    });
    res.status(201).json({ message: 'Community officer account created.', user: safeUser(user) });
  } catch (err) {
    res.status(400).json({ message: err.code === 11000 ? 'That email is already registered.' : 'Could not create officer.' });
  }
});
app.patch('/api/users/:id', auth, loadUser, permit('administrator'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (String(user._id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot disable your own account.' });
    if (typeof req.body.active === 'boolean') user.active = req.body.active;
    if (user.role === 'officer' && req.body.community) {
      if (!COMMUNITIES.includes(req.body.community)) return res.status(400).json({ message: 'Choose a valid community.' });
      user.community = req.body.community;
    }
    await user.save();
    res.json({ message: 'User account updated.', user: safeUser(user) });
  } catch {
    res.status(400).json({ message: 'Could not update this user.' });
  }
});

app.get('/api/reports', auth, loadUser, async (req, res) => {
  try {
    const filter = reportScope(req.user);
    if (req.user.role === 'administrator' && req.query.community && COMMUNITIES.includes(req.query.community))
      filter.community = req.query.community;
    if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.search) {
      const q = safeRegex(req.query.search);
      filter.$or = [
        { residentName: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { wasteType: { $regex: q, $options: 'i' } }
      ];
    }
    const reports = await WasteReport.find(filter).sort({ createdAt: -1 }).populate('submittedBy', 'fullName email');
    res.json(reports);
  } catch {
    res.status(500).json({ message: 'Could not load waste reports.' });
  }
});

app.post('/api/reports', auth, loadUser, async (req, res) => {
  try {
    const body = req.body || {};
    const community = req.user.role === 'resident' ? req.user.community : body.community;
    if (!COMMUNITIES.includes(community) || !WASTE_TYPES.includes(body.wasteType) ||
        !Number.isFinite(Number(body.quantity)) || Number(body.quantity) <= 0 ||
        !['kg', 'bags', 'bins'].includes(body.unit || 'kg') ||
        !String(body.location || '').trim() || !body.collectionDate)
      return res.status(400).json({ message: 'Complete all required report fields with valid values.' });
    if (req.user.role === 'officer' && community !== req.user.community)
      return res.status(403).json({ message: 'You can only report waste in your assigned community.' });
    const report = await WasteReport.create({
      residentName: req.user.role === 'resident' ? req.user.fullName : String(body.residentName || '').trim(),
      community, wasteType: body.wasteType, quantity: Number(body.quantity),
      unit: body.unit || 'kg', location: String(body.location).trim(),
      description: String(body.description || '').trim(),
      collectionDate: new Date(body.collectionDate),
      status: 'Pending', submittedBy: req.user._id, photoUrl: String(body.photoUrl||'')
    });
    await logActivity(req.user,'Waste report created',`Report ${report._id}`,community);
    if(req.user.role!=='resident') { const residents=await User.find({role:'resident',community,active:true}).select('_id'); for(const resident of residents) await notifyUser(resident._id,'New community waste report',`A new ${report.wasteType.toLowerCase()} waste report was recorded in ${community}.`,'#reports'); }
    res.status(201).json({ message: 'Waste report saved successfully.', report });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Could not save report.' });
  }
});

app.get('/api/reports/:id', auth, loadUser, async (req, res) => {
  try {
    const report = await WasteReport.findOne({ _id: req.params.id, ...reportScope(req.user) });
    if (!report) return res.status(404).json({ message: 'Report not found or access denied.' });
    res.json(report);
  } catch {
    res.status(400).json({ message: 'Invalid report ID.' });
  }
});

app.put('/api/reports/:id', auth, loadUser, async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...reportScope(req.user) };
    const body = req.body || {};
    const update = {};
    if (req.user.role === 'administrator') {
      for (const field of ['residentName', 'community', 'wasteType', 'quantity', 'unit', 'location', 'description', 'collectionDate', 'status'])
        if (body[field] !== undefined) update[field] = body[field];
    } else if (req.user.role === 'officer') {
      if (body.status !== undefined) update.status = body.status;
      if (body.description !== undefined) update.description = body.description;
    } else {
      // Residents may edit their own report details only while it is still pending.
      if (body.residentName !== undefined || body.community !== undefined || body.status !== undefined)
        return res.status(403).json({ message: 'Residents cannot change reporter, community or collection status.' });
      const existing = await WasteReport.findOne(filter);
      if (!existing) return res.status(404).json({ message: 'Report not found or access denied.' });
      if (existing.status !== 'Pending') return res.status(403).json({ message: 'Only pending reports can be edited by residents.' });
      for (const field of ['wasteType', 'quantity', 'unit', 'location', 'description', 'collectionDate'])
        if (body[field] !== undefined) update[field] = body[field];
    }
    if (update.community && !COMMUNITIES.includes(update.community)) return res.status(400).json({ message: 'Invalid community.' });
    if (update.status && !STATUSES.includes(update.status)) return res.status(400).json({ message: 'Invalid status.' });
    const report = await WasteReport.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ message: 'Report not found or access denied.' });
    await logActivity(req.user,'Waste report updated',`Report ${report._id}`,report.community);
    if(body.status) await notifyUser(report.submittedBy,'Waste report status updated',`Your report is now: ${report.status}.`,'#reports');
    res.json({ message: 'Waste report updated.', report });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Could not update report.' });
  }
});

app.delete('/api/reports/:id', auth, loadUser, async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...reportScope(req.user) };
    if (req.user.role === 'resident') {
      const report = await WasteReport.findOne(filter);
      if (!report) return res.status(404).json({ message: 'Report not found or access denied.' });
      if (report.status !== 'Pending') return res.status(403).json({ message: 'Only pending reports can be deleted by residents.' });
    } else if (req.user.role !== 'administrator') {
      return res.status(403).json({ message: 'Only administrators and report owners may delete reports.' });
    }
    const deleted = await WasteReport.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ message: 'Report not found.' });
    await logActivity(req.user,'Waste report deleted',`Report ${deleted._id}`,deleted.community);
    res.json({ message: 'Waste report deleted.' });
  } catch {
    res.status(400).json({ message: 'Invalid report ID.' });
  }
});


// Dashboard statistics are calculated from the reports the signed-in user is allowed to see.
app.get('/api/analytics', auth, loadUser, async (req,res)=>{
 try { const filter=reportScope(req.user); const reports=await WasteReport.find(filter).select('community status wasteType createdAt quantity');
 const byCommunity=COMMUNITIES.map(name=>({name,total:reports.filter(r=>r.community===name).length}));
 const byWasteType=WASTE_TYPES.map(name=>({name,total:reports.filter(r=>r.wasteType===name).length}));
 const byMonth=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-5+i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return {month:key,total:reports.filter(r=>{const x=new Date(r.createdAt);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`===key}).length};});
 res.json({total:reports.length,pending:reports.filter(r=>r.status==='Pending').length,inProgress:reports.filter(r=>r.status==='In Progress').length,collected:reports.filter(r=>r.status==='Collected').length,byCommunity,byWasteType,byMonth});
 } catch(e){res.status(500).json({message:'Could not load analytics.'});}
});
app.post('/api/uploads/image',auth,loadUser,imageUpload.single('photo'),(req,res)=>{if(!req.file)return res.status(400).json({message:'Choose a JPG, PNG or WEBP image under 5 MB.'});res.status(201).json({url:`/uploads/${req.file.filename}`});});
app.get('/api/teams',auth,loadUser,async(req,res)=>{const f=req.user.role==='administrator'?{}:{community:req.user.community,active:true};res.json(await CollectionTeam.find(f).sort({community:1,name:1}));});
app.post('/api/teams',auth,loadUser,permit('administrator'),async(req,res)=>{try{const {community,name,teamLead=''}=req.body;if(!COMMUNITIES.includes(community)||!String(name||'').trim())return res.status(400).json({message:'Enter a team name and valid community.'});const team=await CollectionTeam.create({community,name:String(name).trim(),teamLead:String(teamLead).trim()});await logActivity(req.user,'Collection team created',team.name,community);res.status(201).json({message:'Collection team created.',team});}catch(e){res.status(400).json({message:e.code===11000?'That team already exists in this community.':'Could not create team.'});}});
app.patch('/api/teams/:id',auth,loadUser,permit('administrator'),async(req,res)=>{try{const team=await CollectionTeam.findById(req.params.id);if(!team)return res.status(404).json({message:'Team not found.'});if(typeof req.body.active==='boolean')team.active=req.body.active;if(req.body.teamLead!==undefined)team.teamLead=String(req.body.teamLead).slice(0,100);await team.save();await logActivity(req.user,'Collection team updated',team.name,team.community);res.json({message:'Team updated.',team});}catch(e){res.status(400).json({message:'Could not update team.'});}});
app.get('/api/schedules',auth,loadUser,async(req,res)=>{try{const f=req.user.role==='administrator'?{}:{community:req.user.community};res.json(await CollectionSchedule.find(f).sort({collectionDate:1}));}catch(e){res.status(500).json({message:'Could not load schedules.'});}});
app.post('/api/schedules',auth,loadUser,permit('administrator','officer'),async(req,res)=>{try{const b=req.body;const community=req.user.role==='officer'?req.user.community:b.community;if(!COMMUNITIES.includes(community)||!b.collectionDate||!String(b.location||'').trim()||!WASTE_TYPES.includes(b.wasteType)||!String(b.teamName||'').trim())return res.status(400).json({message:'Complete all schedule fields.'});const team=await CollectionTeam.findOne({community,name:String(b.teamName).trim(),active:true});if(!team)return res.status(400).json({message:'Choose an active collection team assigned to this community.'});const item=await CollectionSchedule.create({community,collectionDate:new Date(b.collectionDate),location:b.location,wasteType:b.wasteType,teamName:b.teamName,notes:b.notes||'',createdBy:req.user._id});await logActivity(req.user,'Collection scheduled',`${item.teamName} · ${item.location}`,community);res.status(201).json({message:'Collection scheduled.',schedule:item});}catch(e){res.status(400).json({message:'Could not create schedule.'});}});
app.patch('/api/schedules/:id',auth,loadUser,permit('administrator','officer'),async(req,res)=>{try{const filter={_id:req.params.id,...(req.user.role==='officer'?{community:req.user.community}:{})};const item=await CollectionSchedule.findOne(filter);if(!item)return res.status(404).json({message:'Schedule not found.'});if(req.body.status&&!['Scheduled','In Progress','Completed','Cancelled'].includes(req.body.status))return res.status(400).json({message:'Invalid schedule status.'});for(const k of ['status','teamName','notes','location'])if(req.body[k]!==undefined)item[k]=req.body[k];await item.save();await logActivity(req.user,'Collection schedule updated',`${item._id}`,item.community);res.json({message:'Schedule updated.',schedule:item});}catch(e){res.status(400).json({message:'Could not update schedule.'});}});
app.get('/api/notifications',auth,loadUser,async(req,res)=>res.json(await Notification.find({user:req.user._id}).sort({createdAt:-1}).limit(100)));
app.patch('/api/notifications/:id/read',auth,loadUser,async(req,res)=>{const n=await Notification.findOneAndUpdate({_id:req.params.id,user:req.user._id},{read:true},{new:true});if(!n)return res.status(404).json({message:'Notification not found.'});res.json(n);});
app.patch('/api/notifications/read-all',auth,loadUser,async(req,res)=>{await Notification.updateMany({user:req.user._id,read:false},{read:true});res.json({message:'Notifications marked as read.'});});
app.get('/api/activity',auth,loadUser,permit('administrator'),async(req,res)=>res.json(await ActivityLog.find().sort({createdAt:-1}).limit(200)));
app.get('/api/exports/reports.xlsx',auth,loadUser,permit('administrator','officer'),async(req,res)=>{const f=req.user.role==='administrator'?{}:{community:req.user.community};const rows=await WasteReport.find(f).sort({createdAt:-1});const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Waste reports');ws.columns=[{header:'Reporter',key:'residentName',width:24},{header:'Community',key:'community',width:18},{header:'Waste type',key:'wasteType',width:18},{header:'Quantity',key:'quantity',width:12},{header:'Unit',key:'unit',width:10},{header:'Location',key:'location',width:28},{header:'Collection date',key:'collectionDate',width:18},{header:'Status',key:'status',width:18}];rows.forEach(r=>ws.addRow({residentName:r.residentName,community:r.community,wasteType:r.wasteType,quantity:r.quantity,unit:r.unit,location:r.location,collectionDate:new Date(r.collectionDate).toLocaleDateString(),status:r.status}));ws.getRow(1).font={bold:true};res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition','attachment; filename="MKTrack-waste-reports.xlsx"');await wb.xlsx.write(res);res.end();});
app.get('/api/exports/reports.pdf',auth,loadUser,permit('administrator','officer'),async(req,res)=>{const f=req.user.role==='administrator'?{}:{community:req.user.community};const rows=await WasteReport.find(f).sort({createdAt:-1});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="MKTrack-waste-reports.pdf"');const doc=new PDFDocument({margin:40,size:'A4'});doc.pipe(res);doc.fontSize(20).text('MKTrack Waste Reports');doc.moveDown().fontSize(9).text(`Generated: ${new Date().toLocaleString()} | Records: ${rows.length}`);doc.moveDown();rows.forEach((r,i)=>{doc.fontSize(10).text(`${i+1}. ${r.residentName} | ${r.community} | ${r.wasteType} | ${r.quantity} ${r.unit}`);doc.fontSize(9).text(`${r.location} | ${new Date(r.collectionDate).toLocaleDateString()} | ${r.status}`);doc.moveDown(0.5);if(doc.y>740)doc.addPage();});doc.end();});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is missing or too short. Add a random secret of at least 32 characters to backend/.env.');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is missing. Add it to backend/.env.');
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
