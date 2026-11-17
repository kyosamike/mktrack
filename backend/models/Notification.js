const mongoose=require('mongoose');
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 title:{type:String,required:true,maxlength:120},message:{type:String,required:true,maxlength:500},
 read:{type:Boolean,default:false},link:{type:String,default:''}},{timestamps:true});
module.exports=mongoose.model('Notification',schema);
