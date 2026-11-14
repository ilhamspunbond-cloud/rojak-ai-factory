const $=s=>document.querySelector(s);
let T=localStorage.getItem('tk'),ME=null,CFG={prices:{}},tab='studio',img=null,file=null,asset=null,otpSent=false,phone='',st={c:'#e8e8e8',s:60,x:0,y:0,r:0};
const rp=n=>'Rp'+Number(n||0).toLocaleString('id-ID');
const L={mockup:'Download Mockup Desain',invoice:'Invoice Manual Kustom',afdruk:'Mockup Afdruk Film Sablon',video:'Video Promosi Standar',paket:'Paket Komplit',dtf:'File Pecah Warna DTF',faceswap:'Custom AI Video (Face Swap)'};
async function api(p,o={}){const h={...(o.headers||{})};if(T)h.Authorization='Bearer '+T;let b=o.body;if(b&&!(b instanceof FormData)){b=JSON.stringify(b);h['Content-Type']='application/json'}
 const r=await fetch('/api'+p,{...o,headers:h,body:b});if(o.raw&&r.ok)return r;const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Gagal ('+r.status+')');return j}
function A(n,f){window[n]=async(...a)=>{try{return await f(...a)}catch(e){alert(e.message)}}}
const isAdmin=()=>ME&&ME.admin;
async function boot(){CFG=await api('/settings');$('#an').textContent=CFG.appName;document.title=CFG.appName;const u='/api/icon/64.png?v='+CFG.v;$('#logo').src=u;$('#fav').href=u;
 if(T)try{ME=await api('/me')}catch{T=null;localStorage.removeItem('tk')}
 if(!T&&new URLSearchParams(location.search).get('ref'))tab='akun';go()}
function nav(){const t=[['studio','Studio'],['layanan','Layanan'],['bayar','Bayar'],['akun','Akun']];if(isAdmin())t.push(['admin','Admin']);
 $('#nav').innerHTML=t.map(a=>`<button class="${tab==a[0]?'on':''}" onclick="tab='${a[0]}';go()">${a[1]}</button>`).join('')}
async function go(){nav();let h='';if(tab=='studio')h=studio();else if(tab=='layanan')h=layanan();else if(tab=='bayar')h=await bayar();else if(tab=='akun')h=await akun();else if(tab=='admin')h=await adm();$('#m').innerHTML=h;draw()}
// ---- Studio
function draw(){const c=$('#cv');if(!c)return;const x=c.getContext('2d');c.width=400;c.height=400;x.fillStyle='#fff';x.fillRect(0,0,400,400);x.fillStyle=st.c;x.strokeStyle='#999';x.beginPath();x.moveTo(130,60);x.lineTo(40,120);x.lineTo(75,180);x.lineTo(110,160);x.lineTo(110,360);x.lineTo(290,360);x.lineTo(290,160);x.lineTo(325,180);x.lineTo(360,120);x.lineTo(270,60);x.quadraticCurveTo(200,110,130,60);x.fill();x.stroke();
 if(img){x.save();x.translate(200+st.x,210+st.y);x.rotate(st.r*Math.PI/180);const w=st.s*2,h=w*img.height/img.width;x.drawImage(img,-w/2,-h/2,w,h);x.restore()}}
function studio(){if(!T)return '<div class="c">Masuk dulu di tab Akun.</div>';
 return `<div class="c"><canvas id="cv"></canvas><input type="file" accept="image/*" onchange="pick(this)">
 <div class="r"><button onclick="op('removebg')">Hapus BG</button><button onclick="op('redraw')">Redraw AI</button><button onclick="op('separate')">Pecah warna</button></div>
 <div class="r"><input id="lpi" type="number" value="55" placeholder="LPI"><input id="ang" type="number" value="45" placeholder="Sudut"><button onclick="op('afdruk')">Afdruk</button></div>
 <div class="r"><small>Warna produk</small><input type="color" value="${st.c}" oninput="st.c=this.value;draw()" style="width:60px"></div>
 ${[['s','Ukuran',10,150],['x','Geser X',-100,100],['y','Geser Y',-120,120],['r','Putar',-180,180]].map(a=>`<small>${a[1]}</small><input type="range" min="${a[2]}" max="${a[3]}" value="${st[a[0]]}" oninput="st.${a[0]}=+this.value;draw()">`).join('')}
 <button class="p" onclick="mk()">Render mockup</button>
 ${asset?`<img class="pv" src="${asset.preview}?t=${T}"><button class="p" onclick="dl()">${isAdmin()?'Download':'Download / Bayar'}</button>`:''}</div>
 <div class="c"><b>Prompt desain (Claude)</b><textarea id="pt" placeholder="Contoh: logo kopi gaya retro"></textarea><button onclick="pr()">Rapikan prompt</button><small id="po"></small>
 <button onclick="gi()">Buat gambar AI</button></div>`}
function pick(i){file=i.files[0];if(!file)return;const m=new Image();m.onload=()=>{img=m;draw()};m.src=URL.createObjectURL(file)}
A('op',async o=>{if(!file)throw Error('Pilih gambar dulu');const f=new FormData();f.append('image',file);f.append('lpi',$('#lpi').value);f.append('angle',$('#ang').value);asset=await api('/process/'+o,{method:'POST',body:f});go()});
A('mk',async()=>{if(!asset)throw Error('Proses gambar dulu (mis. Hapus BG)');asset=await api('/mockup',{method:'POST',body:{assetId:asset.assetId,...st,color:st.c}});go()});
A('dl',async()=>{const r=await fetch(`/api/assets/${asset.assetId}/download?t=${T}`);if(r.status==402){tab='bayar';alert('Selesaikan pembayaran dulu');return go()}if(!r.ok)throw Error('Gagal download');const b=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='rojak-'+asset.kind;a.click()});
A('pr',async()=>{const j=await api('/ai/prompt',{method:'POST',body:{text:$('#pt').value}});$('#po').textContent=j.prompt;$('#pt').value=j.prompt});
A('gi',async()=>{asset=await api('/ai/image',{method:'POST',body:{prompt:$('#pt').value}});go()});
// ---- Layanan (invoice, video)
function layanan(){if(!T)return '<div class="c">Masuk dulu di tab Akun.</div>';
 return `<div class="c"><b>Invoice kustom</b><input id="ib" placeholder="Nama brand"><input id="ic" placeholder="Nama customer"><input id="ia" placeholder="Alamat customer"><input id="in" placeholder="Nama barang"><input id="iq" type="number" placeholder="Qty"><input id="ip" type="number" placeholder="Harga satuan"><button class="p" onclick="inv()">Pesan invoice (${rp(CFG.prices.invoice)})</button></div>
 <div class="c"><b>Video promosi</b><small>Pakai aset mockup terakhir di Studio.</small><button class="p" onclick="vid('video',{})">Pesan video (${rp(CFG.prices.video)})</button></div>
 <div class="c"><b>Video viral / Face Swap (maks 5 menit)</b><input id="vr" placeholder="Link video referensi"><input id="vt" placeholder="Karakter target"><input id="vd" type="number" placeholder="Durasi detik (maks 300)"><button class="p" onclick="vfs()">Pesan (${rp(CFG.prices.faceswap)})</button></div>`}
A('inv',async()=>{await api('/orders',{method:'POST',body:{item:'invoice',meta:{brand:$('#ib').value,customer:$('#ic').value,address:$('#ia').value,items:[{name:$('#in').value,qty:+$('#iq').value,price:+$('#ip').value}]}}});tab='bayar';go()});
A('vid',async(item,meta)=>{await api('/orders',{method:'POST',body:{item,assetId:asset&&asset.assetId,meta}});tab='bayar';go()});
A('vfs',()=>vid('faceswap',{reference:$('#vr').value,target:$('#vt').value,duration:+$('#vd').value}));
// ---- Bayar
async function bayar(){if(!T)return '<div class="c">Masuk dulu di tab Akun.</div>';if(isAdmin())return '<div class="c">Admin gratis, tanpa watermark.</div>';ME=await api('/me');
 return `<div class="c"><select id="it">${Object.keys(L).map(k=>`<option value="${k}">${L[k]} - ${rp(CFG.prices[k])}</option>`).join('')}</select><button class="p" onclick="ord()">Buat pesanan${asset?' (untuk aset terakhir)':''}</button></div>
 <div class="c"><b>Transfer ke:</b><br>${CFG.bank.replace(/\n/g,'<br>')}<br>${CFG.hasQris?'<img class="pv" src="/api/qris">':'<small>QRIS belum diatur</small>'}</div>
 <div class="c"><b>Pesanan saya</b>${ME.orders.map(o=>`<div class="r"><span>#${o.id} ${L[o.item]}<br><small>${o.status}</small></span>${o.status=='dibuat'?`<input type="file" accept="image/*" style="width:140px" onchange="bukti(${o.id},this)">`:''}${o.status=='lunas'&&o.item=='invoice'?`<button onclick="pdf(${o.id})">PDF</button>`:''}</div>`).join('')||'<small>Belum ada</small>'}</div>`}
A('ord',async()=>{const item=$('#it').value;await api('/orders',{method:'POST',body:{item,assetId:asset&&asset.assetId}});go()});
A('bukti',async(id,i)=>{const f=new FormData();f.append('image',i.files[0]);await api(`/orders/${id}/proof`,{method:'POST',body:f});go()});
A('pdf',async id=>{const r=await api(`/orders/${id}/invoice.pdf`,{raw:true}),b=await r.blob();window.open(URL.createObjectURL(b))});
// ---- Akun
async function akun(){if(T&&!isAdmin()){ME=await api('/me');return `<div class="c">Masuk: <b>${ME.phone}</b><br>Saldo afiliasi: <b>${rp(ME.balance)}</b><br><small>Link referral:<br>${location.origin}/?ref=${ME.refCode}</small>
 <input id="pa" type="number" placeholder="Jumlah tarik (min ${rp(CFG.minPayout)})"><button onclick="po()">Tarik saldo</button><button onclick="out()">Keluar</button></div>
 <div class="c"><b>Video saya</b>${ME.jobs.map(j=>`<div>#${j.id} ${j.type}: ${j.status} ${j.output_url?`<a href="${j.output_url}">unduh</a>`:''}</div>`).join('')||'<small>Belum ada</small>'}</div>`}
 if(isAdmin())return '<div class="c">Masuk sebagai admin<button onclick="out()">Keluar</button></div>';
 return `<div class="c"><input id="wa" placeholder="Nomor WhatsApp (08xxx)" inputmode="tel" value="${phone}">${otpSent?`<input id="ot" placeholder="Kode OTP" inputmode="numeric"><button class="p" onclick="vo()">Verifikasi</button>`:`<button class="p" onclick="ro()">Kirim OTP</button>`}</div>
 <div class="c"><small>Admin: </small><input id="ak" type="password" placeholder="Kunci admin"><button onclick="al()">Masuk admin</button></div>`}
A('ro',async()=>{phone=$('#wa').value;const j=await api('/auth/otp',{method:'POST',body:{phone}});otpSent=true;if(j.devOtp)alert('Mode dev, OTP: '+j.devOtp);go()});
A('vo',async()=>{const j=await api('/auth/verify',{method:'POST',body:{phone,code:$('#ot').value,ref:new URLSearchParams(location.search).get('ref')||''}});T=j.token;localStorage.setItem('tk',T);otpSent=false;ME=await api('/me');tab='studio';go()});
A('al',async()=>{const j=await api('/auth/admin',{method:'POST',body:{key:$('#ak').value}});T=j.token;localStorage.setItem('tk',T);ME=await api('/me');tab='admin';go()});
A('po',async()=>{await api('/affiliate/payout',{method:'POST',body:{amount:+$('#pa').value}});alert('Permintaan penarikan dikirim');go()});
window.out=()=>{T=null;ME=null;asset=null;localStorage.removeItem('tk');tab='akun';go()};
// ---- Admin
async function adm(){const s=await api('/admin/stats'),o=await api('/admin/orders');
 return `<div class="c"><b>Ringkasan</b><br>Pengunjung hari ini: ${s.visitorsToday} | User: ${s.users}<br>Omzet total: ${rp(s.omzetTotal)}<table>${s.omzetHarian.slice(0,7).map(d=>`<tr><td>${d.d}</td><td>${rp(d.s)}</td></tr>`).join('')}</table></div>
 <div class="c"><b>Logo aplikasi</b><input type="file" accept="image/*" onchange="lg(this,'logo')"><small>Dipakai di header, favicon, dan ikon PWA/APK.</small><b>Nama app</b><input id="sn" value="${CFG.appName}"><button onclick="sv()">Simpan nama</button></div>
 <div class="c"><b>Harga & afiliasi</b>${Object.keys(L).map(k=>`<div class="r"><small>${L[k]}</small><input type="number" id="p_${k}" value="${CFG.prices[k]}" style="width:110px"></div>`).join('')}<div class="r"><small>Komisi afiliasi %</small><input type="number" id="km" style="width:110px" placeholder="mis. 10"></div><div class="r"><small>Minimal payout</small><input type="number" id="mp" value="${CFG.minPayout}" style="width:110px"></div><button class="p" onclick="sv()">Simpan harga</button></div>
 <div class="c"><b>Rekening</b><textarea id="bk">${CFG.bank}</textarea><button onclick="sv()">Simpan rekening</button><b>QRIS</b><input type="file" accept="image/*" onchange="lg(this,'qris')"></div>
 <div class="c"><b>Validasi pembayaran</b>${o.map(x=>`<div class="r"><span>#${x.id} ${x.phone} ${L[x.item]} ${rp(x.price)}<br><small>${x.status}</small></span>${x.status=='menunggu'?`<span><button onclick="pf(${x.id})">Bukti</button><button class="p" onclick="vl(${x.id})">Lunas</button></span>`:''}</div>`).join('')||'<small>Kosong</small>'}</div>
 <div class="c"><b>Penarikan afiliasi</b>${s.payouts.map(p=>`<div class="r"><span>${p.phone} ${rp(p.amount)}</span><button onclick="pd(${p.id})">Sudah dibayar</button></div>`).join('')||'<small>Kosong</small>'}</div>
 <div class="c"><b>Job video</b>${s.jobs.map(j=>`<div class="r"><span>#${j.id} ${j.type} ${j.status}</span><button onclick="jb(${j.id})">Selesai + link</button></div>`).join('')||'<small>Kosong</small>'}</div>`}
A('sv',async()=>{const prices={};Object.keys(L).forEach(k=>prices[k]=+$('#p_'+k).value);const b={appName:$('#sn').value,prices,bank:$('#bk').value,minPayout:+$('#mp').value};if($('#km').value!=='')b.komisi=+$('#km').value;await api('/admin/settings',{method:'PUT',body:b});await boot();alert('Tersimpan')});
A('lg',async(i,w)=>{const f=new FormData();f.append('image',i.files[0]);await api('/admin/'+w,{method:'POST',body:f});await boot();alert('Tersimpan')});
A('vl',async id=>{await api(`/admin/orders/${id}/validate`,{method:'POST'});go()});
A('pf',async id=>{const r=await api(`/admin/orders/${id}/proof`,{raw:true}),b=await r.blob();window.open(URL.createObjectURL(b))});
A('pd',async id=>{await api(`/admin/payouts/${id}/paid`,{method:'POST'});go()});
A('jb',async id=>{const u=prompt('Link hasil video:');if(u===null)return;await api('/admin/jobs/'+id,{method:'PUT',body:{status:'selesai',output_url:u}});go()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
boot();
