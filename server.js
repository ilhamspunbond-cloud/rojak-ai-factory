const express=require('express'),multer=require('multer'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const app=express(),up=multer({dest:'data/uploads/'}),DB='data/db.json';
fs.mkdirSync('data/uploads',{recursive:true});
const def={settings:{appName:'Rojak Design',logo:'',masterKey:process.env.ADMIN_MASTER_KEY||'Rojak121$',
 prices:{mockup:5000,invoice:5000,afdruk:15000,video:10000,paket:30000,dtfSplit:55000,aiVideo:50000},
 affiliatePct:10,minPayout:50000,banks:[{name:'Mandiri',no:''},{name:'SeaBank',no:''}],qris:'',
 apiKeys:{whatsappUrl:'',whatsappToken:'',imageAI:'',imageAIUrl:'',videoAI:'',faceSwap:'',removeBg:''}},
 users:{},orders:[]};
let db=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB)):def;
db.settings={...def.settings,...db.settings};
const save=()=>fs.writeFileSync(DB,JSON.stringify(db,null,1));save();
const otps={},sess={};
app.use(express.json({limit:'10mb'}));app.use(express.static('public'));
app.use('/files',(q,r,n)=>/^\/(logo|qris)/.test(q.path)?n():r.sendStatus(403),express.static('data/uploads'));
const auth=(q,r,n)=>{const s=sess[q.headers['x-token']];if(!s)return r.status(401).json({error:'login dulu'});q.s=s;n()};
const adm=(q,r,n)=>auth(q,r,()=>q.s.admin?n():r.status(403).json({error:'bukan admin'}));
const pub=()=>{const{masterKey,apiKeys,...s}=db.settings;return s};
app.get('/api/config',(q,r)=>r.json(pub()));
// OTP WhatsApp
app.post('/api/otp',async(q,r)=>{const p=String(q.body.phone||'').replace(/\D/g,'');if(p.length<9)return r.status(400).json({error:'nomor salah'});
 const c=String(crypto.randomInt(100000,999999));otps[p]=c;const k=db.settings.apiKeys;
 if(k.whatsappUrl)try{await fetch(k.whatsappUrl,{method:'POST',headers:{'Content-Type':'application/json',Authorization:k.whatsappToken},body:JSON.stringify({target:p,phone:p,message:`Kode OTP Rojak Design: ${c}`})})}catch(e){return r.status(502).json({error:'gateway WA gagal'})}
 else console.log('OTP (WA API key belum diisi)',p,c);r.json({ok:true})});
app.post('/api/login',(q,r)=>{const p=String(q.body.phone||'').replace(/\D/g,''),o=String(q.body.otp||'');
 const admin=o===db.settings.masterKey;if(!admin&&otps[p]!==o)return r.status(401).json({error:'OTP salah'});delete otps[p];
 db.users[p]=db.users[p]||{phone:p,ref:crypto.randomBytes(4).toString('hex'),balance:0,by:q.body.ref||null};save();
 const t=crypto.randomBytes(24).toString('hex');sess[t]={phone:p,admin};r.json({token:t,admin,user:db.users[p]})});
// Order & bayar
app.post('/api/orders',auth,(q,r)=>{const{service}=q.body,price=q.s.admin?0:db.settings.prices[service];if(price===undefined)return r.status(400).json({error:'layanan?'});
 const o={id:crypto.randomUUID(),phone:q.s.phone,service,price,status:price===0?'lunas':'menunggu_bayar',proof:null,at:Date.now()};db.orders.push(o);save();r.json(o)});
app.post('/api/orders/:id/proof',auth,up.single('proof'),(q,r)=>{const o=db.orders.find(x=>x.id==q.params.id&&x.phone==q.s.phone);if(!o)return r.sendStatus(404);o.proof=q.file.filename;o.status='menunggu_verifikasi';save();r.json(o)});
app.get('/api/orders',auth,(q,r)=>r.json(db.orders.filter(o=>q.s.admin||o.phone==q.s.phone)));
app.get('/api/orders/:id/download',auth,(q,r)=>{const o=db.orders.find(x=>x.id==q.params.id);if(!o||!o.result)return r.sendStatus(404);
 if(o.status!=='lunas'&&!q.s.admin)return r.status(402).json({error:'belum lunas'});r.download(path.resolve('data/uploads',o.result))});
// AI generate (adapter generik, sesuaikan dengan provider)
app.post('/api/generate',auth,async(q,r)=>{const k=db.settings.apiKeys;if(!k.imageAI||!k.imageAIUrl)return r.status(400).json({error:'API key AI Image belum diisi di Admin > Pengaturan'});
 try{const x=await fetch(k.imageAIUrl,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+k.imageAI},body:JSON.stringify({prompt:q.body.prompt})});r.json(await x.json())}catch(e){r.status(502).json({error:e.message})}});
// Admin
app.get('/api/admin/settings',adm,(q,r)=>{const s=JSON.parse(JSON.stringify(db.settings));r.json(s)});
app.put('/api/admin/settings',adm,(q,r)=>{db.settings={...db.settings,...q.body,prices:{...db.settings.prices,...q.body.prices},apiKeys:{...db.settings.apiKeys,...q.body.apiKeys}};save();r.json({ok:true})});
app.post('/api/admin/logo',adm,up.single('logo'),(q,r)=>{const n='logo'+path.extname(q.file.originalname);fs.renameSync(q.file.path,'data/uploads/'+n);db.settings.logo='/files/'+n+'?v='+Date.now();save();r.json({logo:db.settings.logo})});
app.post('/api/admin/qris',adm,up.single('qris'),(q,r)=>{const n='qris'+path.extname(q.file.originalname);fs.renameSync(q.file.path,'data/uploads/'+n);db.settings.qris='/files/'+n+'?v='+Date.now();save();r.json({qris:db.settings.qris})});
app.get('/api/admin/proof/:f',adm,(q,r)=>r.sendFile(path.resolve('data/uploads',path.basename(q.params.f))));
app.post('/api/admin/orders/:id/approve',adm,up.single('result'),(q,r)=>{const o=db.orders.find(x=>x.id==q.params.id);if(!o)return r.sendStatus(404);
 o.status='lunas';if(q.file)o.result=q.file.filename;const u=db.users[o.phone],ref=u&&db.users[Object.keys(db.users).find(p=>db.users[p].ref==u.by)];
 if(ref)ref.balance+=Math.round(o.price*db.settings.affiliatePct/100);save();r.json(o)});
app.get('/api/admin/stats',adm,(q,r)=>{const l=db.orders.filter(o=>o.status=='lunas');r.json({users:Object.keys(db.users).length,orders:db.orders.length,omset:l.reduce((a,o)=>a+o.price,0)})});
app.listen(process.env.PORT||3000,()=>console.log('Rojak Design jalan'));
