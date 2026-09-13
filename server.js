const express=require('express');
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const session=require('express-session');
const bcrypt=require('bcryptjs');
const multer=require('multer');
const nodemailer=require('nodemailer');

const app=express();
const PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,'data','store.json');
const UPLOAD=path.join(__dirname,'public','uploads');
fs.mkdirSync(path.dirname(DATA),{recursive:true});
fs.mkdirSync(UPLOAD,{recursive:true});

const defaultSettings={
 businessName:'Bhai Bhai Aluminium Industries',tagline:'Stronger utensils. Brighter tomorrow.',logo:'',whatsapp:'',phone:'',address:'Antardwipa, Bhasaipaikar, Samserganj, Murshidabad, West Bengal',mapsUrl:'',experienceVideo:'',heroDescription:'Premium aluminium utensils and household products, made for everyday life.',aboutText:'At Bhai Bhai Aluminium Industries, we make practical aluminium products for homes, hotels and businesses. Add your real story here from the private admin panel.',experienceTitle:'See the work behind the product.',experienceDescription:'Show customers your real factory, workshop or store process here.',backgroundImage:''
};
const initial={settings:defaultSettings,credentials:{username:(process.env.ADMIN_USER||'admin').trim(),passwordHash:process.env.ADMIN_PASSWORD_HASH||bcrypt.hashSync(process.env.ADMIN_PASSWORD||'ChangeMe123!',12)},products:[],faqs:[],reviews:[]};
if(!fs.existsSync(DATA))fs.writeFileSync(DATA,JSON.stringify(initial,null,2));
function read(){
 let d;try{d=JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{d=JSON.parse(JSON.stringify(initial))}
 d.settings={...defaultSettings,...(d.settings||{})};
 d.products=Array.isArray(d.products)?d.products:[]; d.faqs=Array.isArray(d.faqs)?d.faqs:[]; d.reviews=Array.isArray(d.reviews)?d.reviews:[];
 if(!d.credentials)d.credentials={};
 if(!d.credentials.username)d.credentials.username=(process.env.ADMIN_USER||'admin').trim();
 if(!d.credentials.passwordHash)d.credentials.passwordHash=process.env.ADMIN_PASSWORD_HASH||bcrypt.hashSync(process.env.ADMIN_PASSWORD||'ChangeMe123!',12);
 return d;
}
function write(d){fs.writeFileSync(DATA,JSON.stringify(d,null,2));}
function maskEmail(e){if(!e)return '';const [u,dom]=e.split('@');return (u?u[0]+'***':'***')+'@'+dom;}
function cleanUsername(v){return String(v||'').trim();}

app.disable('x-powered-by');
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use(session({secret:process.env.SESSION_SECRET||'CHANGE_THIS_SESSION_SECRET_IN_RENDER',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:86400000}}));
app.use(express.static(path.join(__dirname,'public')));
function auth(req,res,next){if(req.session.admin)return next();res.status(401).json({error:'Unauthorized'});}

const upload=multer({storage:multer.diskStorage({destination:UPLOAD,filename:(r,f)=>Date.now()+'-'+f.originalname.replace(/[^a-zA-Z0-9._-]/g,'-')}),limits:{fileSize:8*1024*1024}});

const otpStore=new Map();
const MAX_OTP_ATTEMPTS=5;
function smtpReady(){return !!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS&&process.env.OWNER_EMAIL);}
function mailer(){return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});}
async function sendOtp(kind,otp){
 if(!smtpReady())throw new Error('Email OTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS and OWNER_EMAIL in Render.');
 await mailer().sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:process.env.OWNER_EMAIL,subject:`Bhai Bhai Aluminium Industries — ${kind} verification code`,text:`Your verification code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`});
}
function makeOtp(){return String(crypto.randomInt(100000,1000000));}
function putFlow(id,flow){otpStore.set(id,{...flow,created:Date.now(),attempts:0,stage:1});}
function getFlow(id){const x=otpStore.get(id);if(!x||Date.now()-x.created>10*60*1000){otpStore.delete(id);return null}return x;}
function token(){return crypto.randomBytes(32).toString('hex');}

app.get('/api/store',(req,res)=>{const d=read();res.json({settings:d.settings,products:d.products,faqs:d.faqs,reviews:d.reviews});});
app.get('/api/admin/me',(req,res)=>res.json({admin:!!req.session.admin}));
app.post('/api/admin/login',async(req,res)=>{try{const d=read(),u=cleanUsername(req.body.username),p=String(req.body.password||'');const okUser=u===cleanUsername(d.credentials.username);const okPass=await bcrypt.compare(p,d.credentials.passwordHash);if(!okUser||!okPass)return res.status(401).json({error:'Invalid username or password.'});req.session.admin=true;req.session.save(()=>res.json({ok:true}));}catch(e){console.error(e);res.status(500).json({error:'Login service error.'})}});
app.post('/api/admin/logout',auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));

// Credential change: current password + two separate email OTPs.
app.post('/api/admin/credentials/request',auth,async(req,res)=>{try{const d=read();const current=String(req.body.currentPassword||'');if(!(await bcrypt.compare(current,d.credentials.passwordHash)))return res.status(401).json({error:'Current password is incorrect.'});if(!smtpReady())return res.status(503).json({error:'Email OTP is not configured. Add SMTP settings in Render first.'});const id=token(),otp1=makeOtp();putFlow(id,{type:'change',otp1,username:d.credentials.username});await sendOtp('Admin change — OTP 1 of 2',otp1);res.json({ok:true,flowId:id,email:maskEmail(process.env.OWNER_EMAIL),message:'OTP 1 sent to owner email.'});}catch(e){console.error(e);res.status(500).json({error:e.message||'Could not send OTP.'})}});
app.post('/api/admin/credentials/verify1',auth,(req,res)=>{const f=getFlow(req.body.flowId);if(!f||f.type!=='change')return res.status(400).json({error:'Verification expired. Start again.'});if(f.attempts++>=MAX_OTP_ATTEMPTS)return res.status(429).json({error:'Too many attempts.'});if(String(req.body.otp||'')!==f.otp1)return res.status(400).json({error:'Wrong OTP 1.'});f.stage=2;f.otp2=makeOtp();sendOtp('Admin change — OTP 2 of 2',f.otp2).then(()=>res.json({ok:true,message:'OTP 2 sent to owner email.'})).catch(e=>res.status(500).json({error:'Could not send OTP 2.'}));});
app.post('/api/admin/credentials/verify2',auth,(req,res)=>{const f=getFlow(req.body.flowId);if(!f||f.type!=='change'||f.stage!==2)return res.status(400).json({error:'Verification expired. Start again.'});if(f.attempts++>=MAX_OTP_ATTEMPTS)return res.status(429).json({error:'Too many attempts.'});if(String(req.body.otp||'')!==f.otp2)return res.status(400).json({error:'Wrong OTP 2.'});f.stage=3;f.changeToken=token();res.json({ok:true,changeToken:f.changeToken});});
app.post('/api/admin/credentials/commit',auth,async(req,res)=>{try{const f=getFlow(req.body.flowId);if(!f||f.stage!==3||f.changeToken!==req.body.changeToken)return res.status(400).json({error:'Verification expired. Start again.'});const u=cleanUsername(req.body.username),p=String(req.body.password||''),c=String(req.body.confirmPassword||'');if(u.length<3||u.length>50)return res.status(400).json({error:'Admin ID must be 3–50 characters.'});if(p.length<8||p.length>200)return res.status(400).json({error:'Password must be 8–200 characters.'});if(p!==c)return res.status(400).json({error:'Passwords do not match.'});const d=read();d.credentials={username:u,passwordHash:await bcrypt.hash(p,12)};write(d);otpStore.delete(req.body.flowId);req.session.admin=false;res.json({ok:true,message:'Admin login updated. Please log in again.'});}catch(e){console.error(e);res.status(500).json({error:'Could not update credentials.'})}});

// Forgot password: email OTP 1 + email OTP 2, then reset.
app.post('/api/admin/forgot/start',async(req,res)=>{try{if(!smtpReady())return res.status(503).json({error:'Email recovery is not configured. Add SMTP settings in Render first.'});const supplied=cleanUsername(req.body.username);const d=read();if(supplied&&supplied!==cleanUsername(d.credentials.username))return res.status(400).json({error:'Admin ID not recognized.'});const id=token(),otp1=makeOtp();putFlow(id,{type:'forgot',otp1});await sendOtp('Password recovery — OTP 1 of 2',otp1);res.json({ok:true,flowId:id,email:maskEmail(process.env.OWNER_EMAIL)});}catch(e){console.error(e);res.status(500).json({error:e.message||'Could not start recovery.'})}});
app.post('/api/admin/forgot/verify1',async(req,res)=>{const f=getFlow(req.body.flowId);if(!f||f.type!=='forgot')return res.status(400).json({error:'Recovery expired. Start again.'});if(f.attempts++>=MAX_OTP_ATTEMPTS)return res.status(429).json({error:'Too many attempts.'});if(String(req.body.otp||'')!==f.otp1)return res.status(400).json({error:'Wrong OTP 1.'});f.stage=2;f.otp2=makeOtp();try{await sendOtp('Password recovery — OTP 2 of 2',f.otp2);res.json({ok:true,message:'OTP 2 sent.'})}catch(e){res.status(500).json({error:'Could not send OTP 2.'})}});
app.post('/api/admin/forgot/verify2',async(req,res)=>{const f=getFlow(req.body.flowId);if(!f||f.type!=='forgot'||f.stage!==2)return res.status(400).json({error:'Recovery expired. Start again.'});if(f.attempts++>=MAX_OTP_ATTEMPTS)return res.status(429).json({error:'Too many attempts.'});if(String(req.body.otp||'')!==f.otp2)return res.status(400).json({error:'Wrong OTP 2.'});f.stage=3;f.resetToken=token();res.json({ok:true,resetToken:f.resetToken})});
app.post('/api/admin/forgot/reset',async(req,res)=>{try{const f=getFlow(req.body.flowId);if(!f||f.type!=='forgot'||f.stage!==3||f.resetToken!==req.body.resetToken)return res.status(400).json({error:'Recovery expired.'});const u=cleanUsername(req.body.username),p=String(req.body.password||''),c=String(req.body.confirmPassword||'');if(u.length<3||u.length>50)return res.status(400).json({error:'Admin ID must be 3–50 characters.'});if(p.length<8||p.length>200)return res.status(400).json({error:'Password must be 8–200 characters.'});if(p!==c)return res.status(400).json({error:'Passwords do not match.'});const d=read();d.credentials={username:u,passwordHash:await bcrypt.hash(p,12)};write(d);otpStore.delete(req.body.flowId);res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'Could not reset credentials.'})}});

app.get('/api/admin/credentials',auth,(req,res)=>res.json({username:read().credentials.username,ownerEmail:maskEmail(process.env.OWNER_EMAIL)}));

app.post('/api/admin/product',auth,upload.single('image'),(req,res)=>{let d=read();d.products.unshift({id:Date.now().toString(),name:req.body.name||'Product',bn:req.body.bn||'',hi:req.body.hi||'',category:req.body.category||'Other',size:req.body.size||'',price:req.body.price||'',offer:req.body.offer||'',stock:req.body.stock||'In Stock',image:req.file?'/uploads/'+req.file.filename:(req.body.image||''),description:req.body.description||''});write(d);res.json({ok:true});});
app.put('/api/admin/product/:id',auth,upload.single('image'),(req,res)=>{let d=read(),p=d.products.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Product not found.'});Object.assign(p,{name:req.body.name??p.name,bn:req.body.bn??p.bn,hi:req.body.hi??p.hi,category:req.body.category??p.category,size:req.body.size??p.size,price:req.body.price??p.price,offer:req.body.offer??p.offer,stock:req.body.stock??p.stock,description:req.body.description??p.description});if(req.file)p.image='/uploads/'+req.file.filename;else if(req.body.image!==undefined)p.image=req.body.image;write(d);res.json({ok:true});});
app.delete('/api/admin/product/:id',auth,(req,res)=>{let d=read();d.products=d.products.filter(p=>p.id!==req.params.id);write(d);res.json({ok:true})});
app.put('/api/admin/settings',auth,upload.single('logoFile'),(req,res)=>{let d=read();d.settings={...d.settings,...req.body};if(req.file)d.settings.logo='/uploads/'+req.file.filename;write(d);res.json({ok:true,settings:d.settings})});
app.post('/api/admin/review',auth,(req,res)=>{let d=read();d.reviews.unshift({id:Date.now().toString(),name:req.body.name||'',rating:Number(req.body.rating||5),text:req.body.text||''});write(d);res.json({ok:true})});
app.put('/api/admin/review/:id',auth,(req,res)=>{let d=read(),x=d.reviews.find(r=>r.id===req.params.id);if(!x)return res.status(404).json({error:'Review not found.'});Object.assign(x,{name:req.body.name??x.name,rating:Number(req.body.rating??x.rating),text:req.body.text??x.text});write(d);res.json({ok:true})});
app.delete('/api/admin/review/:id',auth,(req,res)=>{let d=read();d.reviews=d.reviews.filter(x=>x.id!==req.params.id);write(d);res.json({ok:true})});
app.post('/api/admin/faq',auth,(req,res)=>{let d=read();d.faqs.unshift({id:Date.now().toString(),q:req.body.q||'',a:req.body.a||''});write(d);res.json({ok:true})});
app.put('/api/admin/faq/:id',auth,(req,res)=>{let d=read(),x=d.faqs.find(f=>f.id===req.params.id);if(!x)return res.status(404).json({error:'FAQ not found.'});Object.assign(x,{q:req.body.q??x.q,a:req.body.a??x.a});write(d);res.json({ok:true})});
app.delete('/api/admin/faq/:id',auth,(req,res)=>{let d=read();d.faqs=d.faqs.filter(x=>x.id!==req.params.id);write(d);res.json({ok:true})});
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.listen(PORT,()=>console.log(`Bhai Bhai Aluminium Industries running on port ${PORT}`));
