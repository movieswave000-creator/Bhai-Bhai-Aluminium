const $ = (s) => document.querySelector(s);
let data = {};
let credFlow = null, credChangeToken = null, forgotFlow = null, forgotResetToken = null;

function msg(id, text, type = '') {
  const e = $(id); if (!e) return;
  e.textContent = text; e.className = 'credentialMsg ' + type;
}
async function api(url, options = {}) {
  const r = await fetch(url, {credentials:'same-origin', cache:'no-store', ...options});
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}
function wireEyes() {
  document.querySelectorAll('[data-eye]').forEach(btn => btn.onclick = () => {
    const input = $('#' + btn.dataset.eye); if (!input) return;
    const show = input.type === 'password'; input.type = show ? 'text' : 'password';
    btn.textContent = show ? '●' : '◉'; btn.title = show ? 'Hide password' : 'Show password';
  });
}
async function check() { try { if ((await api('/api/admin/me')).admin) show(); } catch {} }
function show() {
  $('#login').style.display='none'; $('#forgotPanel').style.display='none'; $('#dashboard').style.display='block';
  load().catch(e => msg('#dashboardStatus', e.message, 'bad'));
}

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    await api('/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:$('#username').value, password:$('#password').value})});
    show();
  } catch (x) { msg('#loginError', x.message, 'bad'); }
  finally { button.disabled = false; }
};
$('#logout').onclick = async () => { try { await api('/api/admin/logout',{method:'POST'}); } finally { location.reload(); } };
$('#forgotOpen').onclick = () => { $('#login').style.display='none'; $('#forgotPanel').style.display='block'; };
$('#forgotBack').onclick = () => location.reload();

$('#forgotStart').onsubmit = async (e) => {
  e.preventDefault();
  try { const j=await api('/api/admin/forgot/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#forgotUser').value})}); forgotFlow=j.flowId; $('#forgotStep2').style.display='block'; msg('#forgotMsg',`OTP 1 sent to ${j.email}.`,'good'); }
  catch(x){msg('#forgotMsg',x.message,'bad');}
};
$('#forgotVerify1').onclick = async () => {
  try { const j=await api('/api/admin/forgot/verify1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flowId:forgotFlow,otp:$('#forgotOtp1').value})}); $('#forgotStep3').style.display='block'; msg('#forgotMsg',j.message,'good'); }
  catch(x){msg('#forgotMsg',x.message,'bad');}
};
$('#forgotVerify2').onclick = async () => {
  try { const j=await api('/api/admin/forgot/verify2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flowId:forgotFlow,otp:$('#forgotOtp2').value})}); forgotResetToken=j.resetToken; $('#forgotStep4').style.display='block'; msg('#forgotMsg','Both OTPs verified. Set a new admin login.','good'); }
  catch(x){msg('#forgotMsg',x.message,'bad');}
};
$('#resetForm').onsubmit = async (e) => {
  e.preventDefault();
  try { await api('/api/admin/forgot/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flowId:forgotFlow,resetToken:forgotResetToken,username:$('#resetUser').value,password:$('#resetPass').value,confirmPassword:$('#resetConfirm').value})}); alert('Admin login reset successfully.'); location.reload(); }
  catch(x){msg('#forgotMsg',x.message,'bad');}
};

function sizeList(p){
  if(Array.isArray(p.sizes)&&p.sizes.length) return p.sizes;
  if(p.size||p.price||p.offer) return [{size:p.size||'',price:p.price||'',offer:p.offer||''}];
  return [{size:'',price:'',offer:''}];
}
function sizeRowsHtml(sizes,prefix){return sizes.map((x,i)=>`<div class="sizeRow" data-row="${i}"><input name="size" value="${esc(x.size||'')}" placeholder="Size e.g. 2L"><input name="price" value="${esc(x.price||'')}" inputmode="decimal" placeholder="Main price"><input name="offer" value="${esc(x.offer||'')}" inputmode="decimal" placeholder="Offer price"><button type="button" class="danger removeSize">Remove</button></div>`).join('')}
function readSizeRows(box){return [...box.querySelectorAll('.sizeRow')].map(r=>({size:r.querySelector('[name=size]').value.trim(),price:r.querySelector('[name=price]').value.trim(),offer:r.querySelector('[name=offer]').value.trim()})).filter(x=>x.size||x.price||x.offer)}
function wireSizeBox(box,initial=[{size:'',price:'',offer:''}]){
  const rows=box.querySelector('.sizeRowsTarget'); if(!rows)return;
  const draw=arr=>{rows.innerHTML=arr.map((x,i)=>`<div class="sizeRow"><input name="size" value="${esc(x.size||'')}" placeholder="Size e.g. 2L"><input name="price" value="${esc(x.price||'')}" placeholder="Main price"><input name="offer" value="${esc(x.offer||'')}" placeholder="Offer price"><button type="button" class="danger removeSize">Remove</button></div>`).join('')};
  draw(initial);
  box.querySelector('.addSizeBtn')?.addEventListener('click',()=>{const a=readSizeRows(box);a.push({size:'',price:'',offer:''});draw(a);});
  box.addEventListener('click',e=>{if(e.target.classList.contains('removeSize')){const row=e.target.closest('.sizeRow');const a=readSizeRows(box).filter((_,i)=>[...rows.children].indexOf(row)!==i);draw(a.length?a:[{size:'',price:'',offer:''}]);}});
}
async function load() {
  data=await api('/api/store');
  const s=data.settings||{}, f=$('#settings');
  if(f) [...f.elements].forEach(x=>{if(x.name&&s[x.name]!==undefined&&x.type!=='file')x.value=s[x.name]||'';});
  try { const c=await api('/api/admin/credentials'); $('#newAdminUser').placeholder='New Admin ID (current: '+c.username+')'; } catch {}
  const el=$('#productsAdmin');
  el.innerHTML=(data.products||[]).map(p=>{const sizes=sizeList(p);return `<div class="adminItem"><form class="editProduct" data-id="${esc(p.id)}" enctype="multipart/form-data"><div class="itemTop"><b>${esc(p.name)}</b><button type="button" class="danger" onclick="removeProduct('${esc(p.id)}')">Delete</button></div><div class="formGrid"><input name="name" value="${esc(p.name)}" required><input name="bn" value="${esc(p.bn||'')}" placeholder="বাংলা"><input name="hi" value="${esc(p.hi||'')}" placeholder="हिन्दी"><input name="category" value="${esc(p.category||'')}" placeholder="Category"><input name="stock" value="${esc(p.stock||'In Stock')}" placeholder="Stock"><label>Replace image<input name="image" type="file" accept="image/*"></label><textarea name="description" placeholder="Description">${esc(p.description||'')}</textarea></div><div class="sizeBox editSizes"><div class="sizeHeader"><b>Sizes & Prices</b><button type="button" class="secondary addSizeBtn">＋ Add another size</button></div><div class="sizeRowsTarget"></div></div><button class="primary" type="submit">Save Product</button></form></div>`}).join('')||'<p class="muted">No products yet.</p>';
  document.querySelectorAll('.editProduct').forEach(form=>{wireSizeBox(form.querySelector('.editSizes'),sizeList((data.products||[]).find(p=>p.id===form.dataset.id)||{}));form.onsubmit=async e=>{e.preventDefault();try{const fd=new FormData(form);fd.set('sizes',JSON.stringify(readSizeRows(form.querySelector('.editSizes'))));await api('/api/admin/product/'+encodeURIComponent(form.dataset.id),{method:'PUT',body:fd});msg('#dashboardStatus','Product saved successfully.','good');await load();}catch(x){alert(x.message);}}});
  const ex=$('#extraAdmin');if(ex)ex.innerHTML=`${(data.reviews||[]).map(r=>`<div class="adminItem"><form class="editReview" data-id="${esc(r.id)}"><input name="name" value="${esc(r.name)}"><select name="rating">${[5,4,3,2,1].map(n=>`<option ${Number(r.rating)===n?'selected':''}>${n}</option>`).join('')}</select><textarea name="text">${esc(r.text)}</textarea><button class="primary">Save Review</button><button type="button" class="danger" onclick="removeReview('${esc(r.id)}')">Delete</button></form></div>`).join('')}${(data.faqs||[]).map(f=>`<div class="adminItem"><form class="editFaq" data-id="${esc(f.id)}"><input name="q" value="${esc(f.q)}"><textarea name="a">${esc(f.a)}</textarea><button class="primary">Save FAQ</button><button type="button" class="danger" onclick="removeFaq('${esc(f.id)}')">Delete</button></form></div>`).join('')}`;
  document.querySelectorAll('.editReview').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/review/'+encodeURIComponent(f.dataset.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});await load();}catch(x){alert(x.message);}});
  document.querySelectorAll('.editFaq').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/faq/'+encodeURIComponent(f.dataset.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});await load();}catch(x){alert(x.message);}});
}
wireEyes();
const sizeBox=$('#product')?.querySelector('.sizeBox');if(sizeBox)wireSizeBox(sizeBox,[{size:'',price:'',offer:''}]);
$('#settings').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/settings',{method:'PUT',body:new FormData(e.target)});msg('#settingsMsg','Website changes saved.','good');await load();}catch(x){msg('#settingsMsg',x.message,'bad');}};
$('#product').onsubmit=async e=>{e.preventDefault();try{const fd=new FormData(e.target);const box=e.target.querySelector('.sizeBox');fd.set('sizes',JSON.stringify(readSizeRows(box)));const btn=e.target.querySelector('button[type=submit]');if(btn)btn.disabled=true;await api('/api/admin/product',{method:'POST',body:fd});e.target.reset();const rows=e.target.querySelector('.sizeRowsTarget');if(rows)rows.innerHTML='<div class="sizeRow"><input name="size" placeholder="Size e.g. 2L"><input name="price" placeholder="Main price"><input name="offer" placeholder="Offer price"><button type="button" class="danger removeSize">Remove</button></div>';msg('#productMsg','Product added successfully.','good');await load();}catch(x){msg('#productMsg',x.message,'bad');}finally{const btn=e.target.querySelector('button[type=submit]');if(btn)btn.disabled=false;}};
$('#review').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();await load();}catch(x){alert(x.message);}};
$('#faqForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/faq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();await load();}catch(x){alert(x.message);}};

$('#credentialStart').onsubmit=async e=>{e.preventDefault();try{const j=await api('/api/admin/credentials/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:$('#currentPassword').value})});credFlow=j.flowId;$('#credOtp1Box').style.display='block';msg('#credentialMsg',`OTP 1 sent to ${j.email}.`,'good');}catch(x){msg('#credentialMsg',x.message,'bad');}};
$('#credVerify1').onclick=async()=>{try{const j=await api('/api/admin/credentials/verify1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flowId:credFlow,otp:$('#credOtp1').value})});$('#credOtp2Box').style.display='block';msg('#credentialMsg',j.message,'good');}catch(x){msg('#credentialMsg',x.message,'bad');}};
$('#credVerify2').onclick=async()=>{try{const j=await api('/api/admin/credentials/verify2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flowId:credFlow,otp:$('#credOtp2').value})});credChangeToken=j.changeToken;$('#credentialCommit').style.display='block';msg('#credentialMsg','Both OTPs verified. Enter the new login.','good');}catch(x){msg('#credentialMsg',x.message,'bad');}};
$('#credentialCommit').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/credentials/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flowId:credFlow,changeToken:credChangeToken,username:$('#newAdminUser').value,password:$('#newAdminPassword').value,confirmPassword:$('#confirmAdminPassword').value})});alert('Admin login changed successfully. Please log in again.');location.reload();}catch(x){msg('#credentialMsg',x.message,'bad');}};
async function remove(url){await api(url,{method:'DELETE'});await load();}
window.removeProduct=id=>{if(confirm('Delete this product?'))remove('/api/admin/product/'+encodeURIComponent(id)).catch(x=>alert(x.message));};
window.removeReview=id=>{if(confirm('Delete this review?'))remove('/api/admin/review/'+encodeURIComponent(id)).catch(x=>alert(x.message));};
window.removeFaq=id=>{if(confirm('Delete this FAQ?'))remove('/api/admin/faq/'+encodeURIComponent(id)).catch(x=>alert(x.message));};
wireEyes(); check();
