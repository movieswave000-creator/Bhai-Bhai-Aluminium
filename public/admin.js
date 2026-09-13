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

async function load() {
  data = await api('/api/store');
  const s=data.settings||{}, f=$('#settings');
  for(const [k,v] of Object.entries(s)){const el=f.elements[k]; if(el&&el.type!=='file') el.value=v||'';}
  renderProducts(); renderExtras();
  try { const c=await api('/api/admin/credentials'); $('#newAdminUser').placeholder='New Admin ID (current: '+c.username+')'; } catch {}
  $('#dashboardStatus').textContent='Dashboard ready. Changes are saved.';
}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function sizeRows(sizes, p){
  let arr=Array.isArray(sizes)&&sizes.length?sizes:[{size:p.size||'',price:p.price||'',offer:p.offer||''}];
  return arr.map((x,i)=>`<div class="sizeRow"><input name="size_${i}" value="${esc(x.size||'')}" placeholder="Size e.g. 2L / 10 inch"><input name="price_${i}" value="${esc(x.price||'')}" inputmode="decimal" placeholder="Main price"><input name="offer_${i}" value="${esc(x.offer||'')}" inputmode="decimal" placeholder="Offer price"><button type="button" class="secondary removeSize">×</button></div>`).join('');
}
function wireSizeEditor(root){
  root.querySelectorAll('.addSize').forEach(btn=>btn.onclick=()=>{const box=document.getElementById(btn.dataset.target);if(!box)return;const i=box.querySelectorAll('.sizeRow').length;const row=document.createElement('div');row.className='sizeRow';row.innerHTML=`<input name="size_${i}" placeholder="Size e.g. 2L / 10 inch"><input name="price_${i}" inputmode="decimal" placeholder="Main price"><input name="offer_${i}" inputmode="decimal" placeholder="Offer price"><button type="button" class="secondary removeSize">×</button>`;box.appendChild(row);});
  root.querySelectorAll('.removeSize').forEach(btn=>btn.onclick=()=>{const box=btn.closest('.sizeEditor');const rows=box.querySelectorAll('.sizeRow');if(rows.length>1)btn.closest('.sizeRow').remove();else rows[0].querySelectorAll('input').forEach(i=>i.value='');});
}
function renderProducts(){
  const el=$('#productsAdmin');
  el.innerHTML=(data.products||[]).map(p=>`<div class="adminItem"><form class="editProduct" data-id="${esc(p.id)}" enctype="multipart/form-data"><div class="itemTop"><b>${esc(p.name)}</b><button type="button" class="danger" onclick="removeProduct('${esc(p.id)}')">Delete</button></div><div class="formGrid"><input name="name" value="${esc(p.name)}" required><input name="bn" value="${esc(p.bn||'')}" placeholder="বাংলা"><input name="hi" value="${esc(p.hi||'')}" placeholder="हिन्दी"><input name="category" value="${esc(p.category||'')}" placeholder="Category"><div class="sizeEditor" id="editSizes_${esc(p.id)}">${sizeRows(p.sizes,p)}</div><button type="button" class="secondary addSize" data-target="editSizes_${esc(p.id)}">+ Add another size</button><select name="stock"><option ${p.stock==='In Stock'?'selected':''}>In Stock</option><option ${p.stock==='Out of Stock'?'selected':''}>Out of Stock</option></select><input name="image" type="file" accept="image/*"><textarea name="description" placeholder="Description">${esc(p.description||'')}</textarea><button class="primary" type="submit">Save Product</button></div></form></div>`).join('')||'<p class="muted">No products yet.</p>';
  wireSizeEditor(el);
  document.querySelectorAll('.editProduct').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;try{await api('/api/admin/product/'+encodeURIComponent(form.dataset.id),{method:'PUT',body:new FormData(form)});await load();}catch(x){alert(x.message);}finally{button.disabled=false;}});
}
function renderExtras(){
  const el=$('#extraAdmin');
  el.innerHTML='<h3>Reviews</h3>'+(data.reviews||[]).map(r=>`<div class="adminItem"><form class="editReview" data-id="${esc(r.id)}"><input name="name" value="${esc(r.name)}"><select name="rating">${[5,4,3,2,1].map(n=>`<option ${n==r.rating?'selected':''}>${n}</option>`).join('')}</select><textarea name="text">${esc(r.text)}</textarea><button class="primary">Save Review</button><button type="button" class="danger" onclick="removeReview('${esc(r.id)}')">Delete</button></form></div>`).join('')+'<h3>FAQs</h3>'+(data.faqs||[]).map(f=>`<div class="adminItem"><form class="editFaq" data-id="${esc(f.id)}"><input name="q" value="${esc(f.q)}"><textarea name="a">${esc(f.a)}</textarea><button class="primary">Save FAQ</button><button type="button" class="danger" onclick="removeFaq('${esc(f.id)}')">Delete</button></form></div>`).join('');
  document.querySelectorAll('.editReview').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/review/'+encodeURIComponent(f.dataset.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});await load();}catch(x){alert(x.message);}});
  document.querySelectorAll('.editFaq').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/faq/'+encodeURIComponent(f.dataset.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});await load();}catch(x){alert(x.message);}});
}
$('#settings').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/settings',{method:'PUT',body:new FormData(e.target)});msg('#settingsMsg','Website changes saved.','good');await load();}catch(x){msg('#settingsMsg',x.message,'bad');}};
$('#product').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;try{await api('/api/admin/product',{method:'POST',body:new FormData(e.target)});e.target.reset();const box=$('#newSizes');box.innerHTML='<div class="sizeRow"><input name="size_0" placeholder="Size e.g. 2L / 10 inch"><input name="price_0" inputmode="decimal" placeholder="Main price"><input name="offer_0" inputmode="decimal" placeholder="Offer price"><button type="button" class="secondary removeSize">×</button></div>';wireSizeEditor(e.target);await load();}catch(x){alert(x.message);}finally{button.disabled=false;}};
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
