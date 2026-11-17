const mongoose=require('mongoose');
const schema=new mongoose.Schema({community:{type:String,required:true,enum:['Bugema','Busiika','Namulonge','Kiwenda','Kiziri']},name:{type:String,required:true,trim:true,maxlength:100},teamLead:{type:String,default:'',trim:true,maxlength:100},active:{type:Boolean,default:true}},{timestamps:true});
schema.index({community:1,name:1},{unique:true});
module.exports=mongoose.model('CollectionTeam',schema);
