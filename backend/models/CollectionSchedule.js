const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  community:{type:String,required:true,enum:['Bugema','Busiika','Namulonge','Kiwenda','Kiziri']},
  collectionDate:{type:Date,required:true}, location:{type:String,required:true,trim:true,maxlength:150},
  wasteType:{type:String,required:true,enum:['Organic','Plastic','Paper','Metal','General','Electronic']},
  teamName:{type:String,required:true,trim:true,maxlength:100}, notes:{type:String,default:'',maxlength:1000},
  status:{type:String,enum:['Scheduled','In Progress','Completed','Cancelled'],default:'Scheduled'},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}
},{timestamps:true});
module.exports=mongoose.model('CollectionSchedule',schema);
