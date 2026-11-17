const mongoose=require('mongoose');
const schema=new mongoose.Schema({actor:{type:mongoose.Schema.Types.ObjectId,ref:'User'},actorName:{type:String,default:'System'},
 action:{type:String,required:true,maxlength:100},details:{type:String,default:'',maxlength:500},community:{type:String,default:''}}, {timestamps:true});
module.exports=mongoose.model('ActivityLog',schema);
