const K='rojak_v1',HASH='c6af49ac4c01522dd0dcf8bbf65c8fa81dfeba5bccfd5ab380e9ffa0bb1517e5';
const D={logo:'',prices:{mockup:5000,invoice:5000,afdruk:15000,video:10000,paket:30000,dtf:55000,faceswap:50000},bank:'Mandiri: -  |  SeaBank: -',qris:'',komisi:10,orders:[]};
let S;try{S=Object.assign({},D,JSON.parse(localStorage.getItem(K)||'{}'))}catch(e){S=D}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){alert('Penyimpanan penuh, gunakan logo lebih kecil')}};
const L={mockup:'Download Mockup Desain',invoice:'Invoice Manual Kustom',afdruk:'Mockup Afdruk Film Sablon',video:'Video Promosi Standar',paket:'Paket Komplit',dtf:'File Pecah Warna DTF',faceswap:'Custom AI Video (Face Swap)'};
const rp=n=>'Rp'+Number(n).toLocaleString('id-ID');
let tab='studio',user=null,admin=false,img=null,st={c:'#e8e8e8',s:60,x:0,y:0,r:0};
const $=s=>document.querySelector(s);
function applyLogo(){const l=S.logo||'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d9480f"/><text x="32" y="43" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">R</text></svg>');
$('#logo').src=l;let f=document.querySelector('link[rel=icon]')||document.head.appendChild(Object.assign(document.createElement('link'),{rel:'icon'}));f.href=l;
}
function nav(){const t=[['studio','Studio'],['bayar','Bayar'],['akun','Akun']];if(admin)t.push(['admin','Admin']);
$('#nav').innerHTML=t.map(a=>`<button class="${tab==a[0]?'on':''}" onclick="tab='${a[0]}';go()">${a[1]}</button>`).join('')}
function paid(){return admin||S.orders.some(o=>o.user==user&&o.status=='lunas'&&['mockup','paket'].includes(o.item))}
function draw(){const c=$('#cv');if(!c)return;const x=c.getContext('2d');c.width=400;c.height=400;x.fillStyle='#fff';x.fillRect(0,0,400,400);
x.fillStyle=st.c;x.strokeStyle='#999';x.beginPath();x.moveTo(130,60);x.lineTo(40,120);x.lineTo(75,180);x.lineTo(110,160);x.lineTo(110,360);x.lineTo(290,360);x.lineTo(290,160);x.lineTo(325,180);x.lineTo(360,120);x.lineTo(270,60);x.quadraticCurveTo(200,110,130,60);x.fill();x.stroke();
if(img){x.save();x.translate(200+st.x,210+st.y);x.rotate(st.r*Math.PI/180);const w=st.s*2,h=w*img.height/img.width;x.drawImage(img,-w/2,-h/2,w,h);x.restore()}
if(!paid()){x.save();x.globalAlpha=.28;x.fillStyle='#000';x.font='bold 18px sans-serif';x.rotate(-.5);for(let i=-3;i<9;i++)for(let j=0;j<5;j++)x.fillText('ROJAK DESIGN - PREVIEW',j*260-120,i*70);x.restore()}}
function studio(){return `<div class="c"><canvas id="cv"></canvas>
<input type="file" accept="image/*" onchange="up(this)"><small>Upload desain/foto sampel. (AI redraw & hapus background butuh backend, lihat catatan di tab Akun.)</small>
<div class="r">Warna produk<input type="color" value="${st.c}" oninput="st.c=this.value;draw()" style="width:60px"></div>
${[['s','Ukuran',10,150],['x','Geser X',-100,100],['y','Geser Y',-120,120],['r','Putar',-180,180]].map(a=>`<small>${a[1]}</small><input type="range" min="${a[2]}" max="${a[3]}" value="${st[a[0]]}" oninput="st.${a[0]}=+this.value;draw()">`).join('')}
<button class="p" onclick="dl()">${paid()?'Download PNG':'Download ('+rp(S.prices.mockup)+')'}</button></div>`}
function up(i){const f=i.files[0];if(!f)return;const im=new Image();im.onload=()=>{img=im;draw()};im.src=URL.createObjectURL(f)}
function dl(){if(!paid()){tab='bayar';go();return}const a=document.createElement('a');a.download='mockup.png';a.href=$('#cv').toDataURL();a.click()}
function bayar(){if(!user)return '<div class="c">Masuk dulu di tab Akun.</div>';
return `<div class="c"><select id="it">${Object.keys(L).map(k=>`<option value="${k}">${L[k]} - ${rp(S.prices[k])}</option>`).join('')}</select>
<button class="p" onclick="order()">Buat pesanan</button></div>
<div class="c"><b>Transfer ke:</b><br>${S.bank}<br>${S.qris?`<img src="${S.qris}" style="max-width:100%;margin-top:8px">`:'<small>QRIS belum diatur admin</small>'}</div>
<div class="c"><b>Pesanan saya</b>${S.orders.filter(o=>o.user==user).map(o=>`<div class="r"><span>${L[o.item]}<br><small>${o.status}</small></span>${o.status=='dibuat'?`<input type="file" accept="image/*" style="width:150px" onchange="bukti(${o.id})">`:''}</div>`).join('')||'<small>Belum ada</small>'}</div>`}
function order(){S.orders.push({id:Date.now(),user,item:$('#it').value,price:S.prices[$('#it').value],status:'dibuat'});save();go()}
function bukti(id){S.orders.find(o=>o.id==id).status='menunggu validasi';save();go()}
let otp=null,num='';
function akun(){if(user)return `<div class="c">Masuk sebagai <b>${user}</b><br><small>Link referral: ${location.href.split('#')[0]}?ref=${user}<br>Komisi ${S.komisi}% per transaksi, minimal tarik Rp50.000</small><br><button onclick="user=null;admin=false;go()">Keluar</button></div>${note()}`;
return `<div class="c"><input id="wa" placeholder="Nomor WhatsApp / kata kunci master" inputmode="tel" value="${num}">
${otp?`<input id="ot" placeholder="Kode OTP"><small>Demo: kode OTP ${otp}. Versi asli dikirim via WhatsApp gateway dari server.</small><button class="p" onclick="vo()">Verifikasi</button>`:`<button class="p" onclick="lo()">Kirim OTP</button>`}</div>${note()}`}
const note=()=>`<div class="c"><small>Prototype frontend. Fitur yang perlu backend: OTP WhatsApp asli, AI redraw, hapus background, video, face swap, pecah warna. Panggilan AI harus lewat server agar API key aman.</small></div>`;
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function lo(){const v=$('#wa').value.trim();num=v;if(await sha(v)==HASH){admin=true;user='admin';tab='admin';return go()}
if(!/^(\+62|62|0)8\d{7,12}$/.test(v))return alert('Nomor WhatsApp tidak valid');otp=String(Math.floor(1e5+Math.random()*9e5));go()}
function vo(){if($('#ot').value==otp){user=num;otp=null;tab='studio';go()}else alert('Kode salah')}
function adm(){return `<div class="c"><b>Logo aplikasi</b><br><input type="file" accept="image/*" onchange="setLogo(this)"><small>Dipakai di header, favicon, dan ikon PWA/APK.</small></div>
<div class="c"><b>Harga</b>${Object.keys(L).map(k=>`<div class="r"><small>${L[k]}</small><input type="number" value="${S.prices[k]}" style="width:110px" onchange="S.prices['${k}']=+this.value;save()"></div>`).join('')}
<div class="r"><small>Komisi afiliasi (%)</small><input type="number" value="${S.komisi}" style="width:110px" onchange="S.komisi=+this.value;save()"></div></div>
<div class="c"><b>Rekening</b><textarea onchange="S.bank=this.value;save()">${S.bank}</textarea><b>QRIS</b><input type="file" accept="image/*" onchange="setQ(this)"></div>
<div class="c"><b>Validasi pembayaran</b>${S.orders.filter(o=>o.status=='menunggu validasi').map(o=>`<div class="r"><span>${o.user}<br><small>${L[o.item]} ${rp(o.price)}</small></span><button class="p" onclick="val(${o.id})">Lunas</button></div>`).join('')||'<small>Tidak ada</small>'}
<hr><small>Omzet lunas: ${rp(S.orders.filter(o=>o.status=='lunas').reduce((a,o)=>a+o.price,0))}</small></div>`}
function toURL(f,max,cb){const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);cb(c.toDataURL('image/png'))};i.src=r.result};r.readAsDataURL(f)}
function setLogo(i){toURL(i.files[0],512,u=>{S.logo=u;save();applyLogo();alert('Logo diperbarui')})}
function setQ(i){toURL(i.files[0],600,u=>{S.qris=u;save()})}
function val(id){S.orders.find(o=>o.id==id).status='lunas';save();go()}
function go(){nav();const v={studio,bayar,akun,admin:adm}[tab]();$('#m').innerHTML=v();draw()}
applyLogo();go();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
