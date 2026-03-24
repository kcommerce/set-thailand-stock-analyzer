'use strict';

/* ═══════════════════════════════════════════════════
   SET Thailand Stock Analyzer — popup.js
   Full activity log visible inside the popup itself.
═══════════════════════════════════════════════════ */

var currentData = null;
var activeTab   = 'chart';
var chartPeriod = '1D';

/* ─────────────────────────────────
   VISIBLE LOG ENGINE
   All activity written here first,
   also mirrored to console.
───────────────────────────────── */
var LOG_LINES = [];

function log(level, msg, detail) {
  var ts    = new Date().toISOString().slice(11,23);
  var entry = { ts: ts, level: level, msg: msg, detail: detail || null };
  LOG_LINES.push(entry);
  var con = level === 'ERR' ? console.error : level === 'WARN' ? console.warn : console.log;
  con('[SET][' + level + ']', msg, detail || '');
  flushLog();
}
function logInfo(msg, d)  { log('INFO', msg, d); }
function logOk(msg, d)    { log('OK',   msg, d); }
function logErr(msg, d)   { log('ERR',  msg, d); }
function logWarn(msg, d)  { log('WARN', msg, d); }

function flushLog() {
  var el = document.getElementById('logPanel');
  if (!el) return;
  el.innerHTML = LOG_LINES.slice(-60).map(function(e) {
    var color = e.level==='OK' ? '#10b981'
              : e.level==='ERR' ? '#ef4444'
              : e.level==='WARN'? '#f59e0b'
              : '#7986a3';
    var detail = e.detail
      ? '<div style="color:#4b5563;font-size:9px;margin-top:2px;padding-left:8px;word-break:break-all;white-space:pre-wrap">'+esc(
          typeof e.detail === 'object' ? JSON.stringify(e.detail,null,2) : String(e.detail)
        ).slice(0,600)+'</div>'
      : '';
    return '<div style="border-bottom:1px solid rgba(255,255,255,0.04);padding:4px 0">' +
      '<span style="color:#374151;font-size:9px">'+e.ts+'</span> ' +
      '<span style="color:'+color+';font-weight:600;font-size:9px">['+e.level+']</span> ' +
      '<span style="color:#d1d5db;font-size:10px">'+esc(e.msg)+'</span>' +
      detail +
    '</div>';
  }).join('');
  el.scrollTop = el.scrollHeight;
}

/* ─────────────────────────────────
   HELPERS
───────────────────────────────── */
function fmt(n, d) {
  d = (d == null) ? 2 : d;
  if (n == null || n === '' || isNaN(n)) return '—';
  return parseFloat(n).toLocaleString('en-US', {minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtBig(n) {
  if (n == null || isNaN(n)) return '—';
  var v = parseFloat(n);
  if (Math.abs(v)>=1e9) return (v/1e9).toFixed(2)+'B';
  if (Math.abs(v)>=1e6) return (v/1e6).toFixed(2)+'M';
  if (Math.abs(v)>=1e3) return (v/1e3).toFixed(1)+'K';
  return v.toLocaleString();
}
function clamp(s,max){ s=String(s||''); return s.length>max?s.slice(0,max)+'…':s; }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ─────────────────────────────────
   UI STATES
───────────────────────────────── */
function setState(state) {
  document.getElementById('emptyState').style.display   = state==='empty'   ? 'block':'none';
  document.getElementById('loadingState').style.display = state==='loading' ? 'block':'none';
  document.getElementById('errorState').style.display   = state==='error'   ? 'block':'none';
  document.getElementById('dashboard').style.display    = state==='data'    ? 'block':'none';
  // log panel always visible
  document.getElementById('logWrap').style.display = 'block';
}

function showError(title, rows) {
  setState('error');
  var el = document.getElementById('errorState');
  var rowsHtml = '';
  if (rows && rows.length) {
    rowsHtml = '<div class="err-details">' + rows.map(function(r){
      var icon = r.ok ? '✓' : '✗';
      var cls  = r.ok ? 'err-row-ok' : 'err-row-fail';
      return '<div class="err-row '+cls+'">' +
        '<span class="err-icon">'+icon+'</span>' +
        '<span class="err-key">'+esc(r.key)+'</span>' +
        '<span class="err-msg">'+esc(r.msg||'')+'</span>' +
        '</div>';
    }).join('') + '</div>';
  }
  el.innerHTML =
    '<div class="err-title">⚠ '+esc(title)+'</div>' +
    rowsHtml +
    '<div class="err-hint">See the <b>Activity Log</b> below for full details.</div>';
}

/* ─────────────────────────────────
   FETCH
───────────────────────────────── */
var SET_BASE = 'https://www.set.or.th/api/set';

function fetchJSON(key, url) {
  logInfo('→ fetch ' + key, url);
  return fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'th,en;q=0.9',
    }
  })
  .then(function(r) {
    logInfo('← response ' + key, 'HTTP ' + r.status + ' ' + r.statusText +
      ' | content-type: ' + (r.headers.get('content-type')||'?') +
      ' | cors: ' + (r.headers.get('access-control-allow-origin')||'none'));

    if (!r.ok) {
      return r.text().then(function(body) {
        logErr('HTTP error ' + key, 'status=' + r.status + ' body=' + body.slice(0,300));
        throw new Error('HTTP ' + r.status + (body ? ' — ' + body.slice(0,120) : ''));
      });
    }
    return r.text().then(function(text) {
      logInfo('← body ' + key, text.slice(0,200) + (text.length>200?'…':''));
      try {
        var parsed = JSON.parse(text);
        var keys   = Object.keys(parsed);
        logOk('✓ parsed ' + key, 'top-level keys: [' + keys.join(', ') + ']');
        return parsed;
      } catch(e) {
        logErr('JSON parse fail ' + key, e.message + ' | raw: ' + text.slice(0,200));
        throw new Error('JSON parse error: ' + e.message);
      }
    });
  })
  .catch(function(e) {
    // catch network-level errors (CORS block, DNS fail, etc.)
    if (e.message.indexOf('HTTP ') === -1 && e.message.indexOf('JSON') === -1) {
      logErr('Network/CORS error ' + key, e.message + ' | stack: ' + (e.stack||''));
    }
    throw e;
  });
}

function safe(key, promise) {
  return promise
    .then(function(v)  { return {key:key, ok:true,  value:v,    msg:'OK'}; })
    .catch(function(e) { return {key:key, ok:false, value:null, msg:e.message, stack:e.stack||''}; });
}

/* ─────────────────────────────────
   MAIN SEARCH
───────────────────────────────── */
function doSearch(sym) {
  sym = sym.trim().toUpperCase();
  if (!sym) return;
  LOG_LINES = [];
  chartPeriod = '1D'; // Reset period on new search
  document.getElementById('symbolInput').value = sym;
  chrome.storage.local.set({lastSymbol: sym});
  setState('loading');
  logInfo('Search started', 'symbol=' + sym);

  // Log extension context info
  logInfo('Extension context', 'chrome.runtime.id=' + chrome.runtime.id);
  logInfo('Document URL', document.location.href);

  var urls = [
    {key:'financial', url: SET_BASE+'/stock/'+sym+'/company-highlight/financial-data?lang=th'},
    {key:'historical',url: SET_BASE+'/stock/'+sym+'/historical-trading?lang=th'},
    {key:'chart',     url: SET_BASE+'/stock/'+sym+'/chart-quotation?period=1D&accumulated=false'},
    {key:'profile',   url: SET_BASE+'/company/'+sym+'/profile?lang=th'},
    {key:'holders',   url: SET_BASE+'/stock/'+sym+'/shareholder?lang=th'},
  ];

  var tasks = urls.map(function(t) {
    return safe(t.key, fetchJSON(t.key, t.url));
  });

  Promise.all(tasks).then(function(results) {
    logInfo('All fetches complete', results.length + ' calls');
    results.forEach(function(r) {
      if (r.ok) logOk(r.key + ' → OK', 'value type: ' + typeof r.value);
      else      logErr(r.key + ' → FAIL', r.msg);
    });

    var anyOk = results.some(function(r){ return r.ok && r.value; });
    if (!anyOk) {
      logErr('All endpoints failed — showing error state');
      var details = results.map(function(r){
        return {key:r.key, ok:r.ok, msg:r.ok?'OK':r.msg};
      });
      showError('All API calls failed for "'+sym+'"', details);
      return;
    }

    function val(k){ var r=results.filter(function(x){return x.key===k;})[0]; return (r&&r.ok)?r.value:null; }
    function err(k){ var r=results.filter(function(x){return x.key===k;})[0]; return (r&&!r.ok)?r.msg:null; }

    currentData = {
      symbol: sym,
      results: {
        financial:val('financial'), historical:val('historical'), chart:val('chart'),
        profile:val('profile'),     holders:val('holders'),
      },
      errors: {
        financial:err('financial'), historical:err('historical'), chart:err('chart'),
        profile:err('profile'),     holders:err('holders'),
      },
      rawResults: results,
    };
    logOk('Rendering dashboard for ' + sym);
    renderDashboard();
  }).catch(function(e) {
    logErr('Promise.all threw', e.message + '\n' + (e.stack||''));
    showError('Unexpected error: '+e.message, null);
  });
}

/* ─────────────────────────────────
   DASHBOARD
───────────────────────────────── */
function renderDashboard() {
  var r = currentData.results;
  setState('data');
  activeTab = 'chart';
  syncTabs();
  renderHero(currentData.symbol, r.financial, r.historical, r.chart, r.profile);
  renderStats(r.financial, r.historical);
  renderTab('chart');
}

function renderHero(sym, fin, hist, chart, profile) {
  var rows = Array.isArray(hist) ? hist : (hist && (hist.trading || hist.historicalTrading || hist.data)) || [];
  var last = rows[0]||{};
  var lastPrice = last.close!=null?last.close:(last.last!=null?last.last:null);
  if (lastPrice==null && chart) {
    var qs=(chart.quotations||chart.data||[]);
    if (qs.length){ var q=qs[qs.length-1]; lastPrice=q.close!=null?q.close:(q.last!=null?q.last:null); }
  }
  var prior  = (chart&&chart.prior!=null)?chart.prior:(rows[1]?(rows[1].close!=null?rows[1].close:rows[1].last):null);
  var change = (lastPrice!=null&&prior!=null)?lastPrice-prior:null;
  var pct    = (change!=null&&prior)?(change/prior*100):null;
  var isUp   = change!=null?change>=0:null;
  var name   = (profile&&(profile.companyNameTh||profile.companyNameEn||profile.companyName))||sym;
  var sector = (profile&&(profile.sector||profile.industry))||'';
  var pc     = isUp===null?'var(--text)':(isUp?'var(--green)':'var(--red)');
  var cc     = isUp===null?'':(isUp?'up':'down');
  var cs     = change!=null?(isUp?'+':'')+fmt(change)+' ('+(isUp?'+':'')+fmt(pct)+'%)':'';
  document.getElementById('companyHero').innerHTML =
    '<div class="hero-left">'+
      '<div class="hero-symbol">'+esc(sym)+'</div>'+
      '<div class="hero-name">'+esc(clamp(name,45))+'</div>'+
      (sector?'<div class="hero-sector">'+esc(sector)+'</div>':'')+
    '</div>'+
    '<div class="hero-right">'+
      '<div class="hero-price" style="color:'+pc+'">'+(lastPrice!=null?fmt(lastPrice):'—')+'</div>'+
      (cs?'<div class="hero-change '+cc+'">'+cs+'</div>':'')+
      '<div class="hero-meta">THB · SET Exchange</div>'+
    '</div>';
}

function renderStats(fin, hist) {
  var rows = Array.isArray(hist) ? hist : (hist && (hist.trading || hist.historicalTrading || hist.data)) || [];
  var last=rows[0]||{};
  var finData = Array.isArray(fin) ? fin[fin.length - 1] : (fin || {});
  var mktCap=finData.marketCap!=null?finData.marketCap:finData.mktCap;
  var vol=last.totalVolume!=null?last.totalVolume:(last.volume!=null?last.volume:last.vol);
  var stats=[
    {label:'Volume', val:fmtBig(vol),   sub:'shares',   color:'var(--accent)'},
    {label:'High',   val:fmt(last.high), sub:'day high', color:'var(--green)'},
    {label:'Low',    val:fmt(last.low),  sub:'day low',  color:'var(--red)'},
    {label:'Mkt Cap',val:fmtBig(mktCap), sub:'THB',      color:'var(--gold)'},
  ];
  document.getElementById('statRow').innerHTML=stats.map(function(s){
    return '<div class="stat-card" style="border-left:2px solid '+s.color+'">'+
      '<div class="stat-label">'+s.label+'</div>'+
      '<div class="stat-val" style="color:'+s.color+'">'+s.val+'</div>'+
      '<div class="stat-sub">'+s.sub+'</div></div>';
  }).join('');
}

/* ─────────────────────────────────
   TABS
───────────────────────────────── */
function syncTabs() {
  document.querySelectorAll('.tab').forEach(function(t){
    t.classList.toggle('active', t.dataset.tab===activeTab);
  });
}
function setActiveTab(tab){ activeTab=tab; syncTabs(); renderTab(tab); }
function renderTab(tab) {
  var el=document.getElementById('tabContent');
  el.innerHTML=''; el.classList.remove('fade'); void el.offsetWidth; el.classList.add('fade');
  var r=currentData.results;
  if      (tab==='chart')      renderChartTab(el, r.chart);
  else if (tab==='financials') renderFinTab(el, r.financial);
  else if (tab==='holders')    renderHoldersTab(el, r.holders);
  else if (tab==='history')    renderHistoryTab(el, r.historical);
  else if (tab==='profile')    renderProfileTab(el, r.profile);
  else if (tab==='debug')      renderDebugTab(el);
}

/* ─────────────────────────────────
   CHART TAB
───────────────────────────────── */
function changeChartPeriod(p) {
  if (!currentData || chartPeriod === p) return;
  chartPeriod = p;
  var el = document.getElementById('tabContent');
  // Show loading in chart area
  var wrap = el.querySelector('.chart-wrap');
  if (wrap) wrap.innerHTML = '<div class="chart-loading"><div class="loader"><span></span><span></span><span></span></div></div>';
  
  // Re-sync button states immediately
  el.querySelectorAll('.period-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.p === p);
  });

  var url = SET_BASE + '/stock/' + currentData.symbol + '/chart-quotation?period=' + p + '&accumulated=false';
  fetchJSON('chart-' + p, url)
    .then(function(data) {
      currentData.results.chart = data;
      renderChartTab(el, data);
    })
    .catch(function(e) {
      if (wrap) wrap.innerHTML = '<div class="no-data">Failed to load ' + p + ' chart: ' + e.message + '</div>';
    });
}

function attachPeriodEvents(el) {
  el.querySelectorAll('.period-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      changeChartPeriod(btn.dataset.p);
    });
  });
}

function renderChartTab(el, chart) {
  var periods = ['1D', '1M', '3M', '6M', 'YTD', '1Y'];
  var periodHtml = '<div class="chart-periods">' + periods.map(function(p){
    var cls = p === chartPeriod ? 'period-btn active' : 'period-btn';
    return '<button class="' + cls + '" data-p="' + p + '">' + p + '</button>';
  }).join('') + '</div>';

  if (!chart){ 
    el.innerHTML = periodHtml + '<div class="no-data">Chart data unavailable</div>'; 
    attachPeriodEvents(el);
    return; 
  }
  
  var raw = chart.quotations||chart.data||[];
  var points = raw.filter(function(d){return d.price!=null||d.close!=null||d.last!=null||d.value!=null;});
  var prices = points.map(function(d){return +(d.price!=null?d.price:(d.close!=null?d.close:(d.last!=null?d.last:d.value)));});
  
  // Label formatting based on period
  var labels = points.map(function(d){
    var dt = d.datetime || d.localDatetime || '';
    if (chartPeriod === '1D') return dt.slice(11,16);
    return dt.slice(5, 10); // MM-DD for historical periods
  });

  if (prices.length < 2) { 
    el.innerHTML = periodHtml + '<div class="no-data">Not enough data points (' + prices.length + ')</div>'; 
    attachPeriodEvents(el);
    return; 
  }

  var isUp = prices[prices.length-1] >= (chart.prior || prices[0]);
  var color = isUp ? '#10b981' : '#ef4444';
  var cd = buildSVGChart(prices, labels, color);
  
  el.innerHTML = periodHtml + '<div class="chart-wrap" style="position:relative">' + cd.svg + '</div>';
  attachChartHover(el.querySelector('.chart-wrap'), cd);
  attachPeriodEvents(el);
}

function buildSVGChart(prices,labels,color){
  var W=448,H=170,P={top:12,right:52,bottom:24,left:8};
  var pw=W-P.left-P.right, ph=H-P.top-P.bottom;
  var minP=Math.min.apply(null,prices), maxP=Math.max.apply(null,prices);
  var span=maxP-minP||1, pad=span*0.06;
  minP-=pad; maxP+=pad; span=maxP-minP;
  function sx(i){return P.left+(i/(prices.length-1))*pw;}
  function sy(v){return P.top+(1-(v-minP)/span)*ph;}
  var pts=prices.map(function(p,i){return[sx(i),sy(p)];});
  var d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(var i=0;i<pts.length-1;i++){
    var p0=pts[Math.max(i-1,0)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(i+2,pts.length-1)];
    d+=' C'+(p1[0]+(p2[0]-p0[0])/6).toFixed(1)+' '+(p1[1]+(p2[1]-p0[1])/6).toFixed(1)+
        ','+(p2[0]-(p3[0]-p1[0])/6).toFixed(1)+' '+(p2[1]-(p3[1]-p1[1])/6).toFixed(1)+
        ','+p2[0].toFixed(1)+' '+p2[1].toFixed(1);
  }
  var lp=pts[pts.length-1];
  var fillD=d+' L'+lp[0].toFixed(1)+' '+(P.top+ph)+' L'+pts[0][0].toFixed(1)+' '+(P.top+ph)+' Z';
  var grid=[0,0.33,0.67,1].map(function(t){
    var gy=P.top+(1-t)*ph,gv=minP+t*span;
    return '<line x1="'+P.left+'" x2="'+(P.left+pw)+'" y1="'+gy.toFixed(1)+'" y2="'+gy.toFixed(1)+'" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>'+
           '<text x="'+(P.left+pw+3)+'" y="'+(gy+3).toFixed(1)+'" font-size="8" fill="#7986a3" font-family="monospace">'+gv.toFixed(2)+'</text>';
  }).join('');
  var xStep=Math.max(1,Math.floor(prices.length/5)),xTicks='';
  for(var j=0;j<prices.length;j+=xStep){if(labels[j])xTicks+='<text x="'+sx(j).toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle" font-size="8" fill="#7986a3" font-family="sans-serif">'+esc(labels[j])+'</text>';}
  var gid='g'+Math.floor(Math.random()*1e6);
  var rgb=color==='#10b981'?'16,185,129':'239,68,68';
  return {
    svg:'<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'+
      '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0%" stop-color="rgba('+rgb+',0.22)"/><stop offset="100%" stop-color="rgba('+rgb+',0)"/></linearGradient></defs>'+
      grid+xTicks+
      '<path d="'+fillD+'" fill="url(#'+gid+')" stroke="none"/>'+
      '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'+
      '<circle cx="'+lp[0].toFixed(1)+'" cy="'+lp[1].toFixed(1)+'" r="3" fill="'+color+'"/>'+
      '<line id="hline" x1="0" x2="0" y1="'+P.top+'" y2="'+(P.top+ph)+'" stroke="rgba(255,255,255,0.25)" stroke-width="1" opacity="0"/>'+
      '<circle id="hdot" cx="0" cy="0" r="4" fill="'+color+'" stroke="#fff" stroke-width="1.5" opacity="0"/>'+
      '<rect id="hit" x="'+P.left+'" y="'+P.top+'" width="'+pw+'" height="'+ph+'" fill="transparent" style="cursor:crosshair"/>'+
      '</svg>',
    pts:pts, prices:prices, labels:labels, W:W, H:H, color:color
  };
}

function attachChartHover(wrap,cd){
  var svgEl=wrap.querySelector('svg'),hline=wrap.querySelector('#hline'),
      hdot=wrap.querySelector('#hdot'),hit=wrap.querySelector('#hit');
  var tip=document.createElement('div');
  tip.style.cssText='position:absolute;background:#0f172a;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 8px;font-size:10px;font-family:monospace;color:#eef2ff;pointer-events:none;display:none;white-space:nowrap;z-index:10;';
  wrap.appendChild(tip);
  hit.addEventListener('mousemove',function(e){
    var rect=svgEl.getBoundingClientRect(),scaleX=cd.W/rect.width,mouseX=(e.clientX-rect.left)*scaleX;
    var closest=0,minDist=Infinity;
    for(var i=0;i<cd.pts.length;i++){var dist=Math.abs(cd.pts[i][0]-mouseX);if(dist<minDist){minDist=dist;closest=i;}}
    var px=cd.pts[closest][0],py=cd.pts[closest][1];
    hline.setAttribute('x1',px);hline.setAttribute('x2',px);hline.setAttribute('opacity','1');
    hdot.setAttribute('cx',px);hdot.setAttribute('cy',py);hdot.setAttribute('opacity','1');
    tip.textContent='฿'+fmt(cd.prices[closest])+(cd.labels[closest]?'  '+cd.labels[closest]:'');
    tip.style.display='block';
    var tipX=(px/cd.W)*rect.width,tipY=(py/cd.H)*rect.height,tw=tip.offsetWidth||100;
    tip.style.left=(tipX+8+tw>rect.width?tipX-tw-8:tipX+8)+'px';
    tip.style.top=Math.max(0,tipY-16)+'px';
  });
  hit.addEventListener('mouseleave',function(){hline.setAttribute('opacity','0');hdot.setAttribute('opacity','0');tip.style.display='none';});
}

/* ─────────────────────────────────
   FINANCIALS TAB
───────────────────────────────── */
function renderFinTab(el, fin) {
  if (!fin){ el.innerHTML='<div class="no-data">Financial data unavailable</div>'; return; }
  
  var data = Array.isArray(fin) ? fin[fin.length - 1] : fin;
  var year = data.year || '';
  
  function g(a,b){return a!=null?a:(b!=null?b:null);}
  var fields=[
    {l:'P/E',       v:g(data.pe,data.peRatio),               c:'var(--accent)'},
    {l:'P/BV',      v:g(data.pbv,data.pbvRatio),              c:'var(--cyan)'},
    {l:'EPS',       v:data.eps,                               c:'var(--green)'},
    {l:'DPS',       v:data.dps,                               c:'var(--gold)'},
    {l:'Div Yield', v:g(data.dividendYield,data.yield),        c:'var(--purple)',sx:'%'},
    {l:'Net Profit',v:data.netProfit,                         c:'var(--cyan)',  big:true},
    {l:'Revenue',   v:g(data.totalRevenue,data.revenue),      c:'var(--gold)',  big:true},
    {l:'ROE',       v:data.roe,                               c:'var(--green)', sx:'%'},
    {l:'ROA',       v:data.roa,                               c:'var(--accent)',sx:'%'},
    {l:'D/E',       v:g(data.deRatio,data.debtToEquity),       c:'var(--red)'},
    {l:'Assets',    v:g(data.totalAsset,data.totalAssets),    c:'var(--purple)',big:true},
  ].filter(function(f){return f.v!=null&&f.v!==''&&f.v!==0;});

  if(!fields.length){el.innerHTML='<div class="no-data">No financial metrics in response</div>';return;}
  
  var yearHtml = year ? '<div style="font-size:10px;color:var(--muted);margin-bottom:12px;text-align:right">Latest Data: FY'+year+'</div>' : '';
  el.innerHTML=yearHtml+'<div class="fin-grid">'+fields.map(function(f){
    return '<div class="fin-item"><div class="fl">'+f.l+'</div><div class="fv" style="color:'+f.c+'">'+(f.big?fmtBig(f.v):fmt(f.v))+(f.sx||'')+'</div></div>';
  }).join('')+'</div>';
}

/* ─────────────────────────────────
   SHAREHOLDERS TAB
───────────────────────────────── */
function renderHoldersTab(el, holders) {
  var list=(holders&&(holders.majorShareholders||holders.shareholder||holders.shareholders||holders.data))||[];
  if(!list.length){el.innerHTML='<div class="no-data">No shareholder data</div>';return;}
  var top=list.slice(0,10);
  var maxPct=Math.max.apply(null,top.map(function(h){
    var p = h.percentOfShare!=null?h.percentOfShare:(h.percent!=null?h.percent:(h.percentage!=null?h.percentage:(h.holdings||0)));
    return parseFloat(p);
  }));
  el.innerHTML='<table class="sh-table"><thead><tr><th>#</th><th>Shareholder</th><th>%</th></tr></thead><tbody>'+
    top.map(function(h,i){
      var name=h.name||h.holderName||h.holderNameTh||'—';
      var p = h.percentOfShare!=null?h.percentOfShare:(h.percent!=null?h.percent:(h.percentage!=null?h.percentage:(h.holdings||0)));
      var pct=parseFloat(p);
      var bw=maxPct>0?Math.round(pct/maxPct*100):0;
      return '<tr><td style="color:var(--muted);width:18px;font-size:10px">'+(i+1)+'</td>'+
        '<td><div style="font-size:10px;line-height:1.3">'+esc(clamp(name,32))+'</div>'+
        '<div class="sh-bar" style="width:'+bw+'%"></div></td>'+
        '<td>'+fmt(pct,2)+'%</td></tr>';
    }).join('')+'</tbody></table>';
}

/* ─────────────────────────────────
   HISTORY TAB
───────────────────────────────── */
function renderHistoryTab(el, hist) {
  var rows=Array.isArray(hist)?hist:(hist&&(hist.trading||hist.historicalTrading||hist.data))||[];
  if(!rows.length){el.innerHTML='<div class="no-data">No historical data</div>';return;}
  el.innerHTML='<div style="overflow-x:auto"><table class="hist-table"><thead><tr>'+
    '<th style="text-align:left">Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Vol</th>'+
    '</tr></thead><tbody>'+
    rows.slice(0,20).map(function(r){
      var close=r.close!=null?r.close:r.last, open=r.open!=null?r.open:r.prior;
      var isUp=(close!=null&&open!=null)?close>=open:null;
      var cc=isUp===null?'var(--muted)':(isUp?'var(--green)':'var(--red)');
      var vol=r.totalVolume!=null?r.totalVolume:(r.volume!=null?r.volume:r.vol);
      return '<tr>'+
        '<td>'+(r.date||'').slice(0,10)+'</td>'+
        '<td>'+fmt(open)+'</td>'+
        '<td style="color:var(--green)">'+fmt(r.high)+'</td>'+
        '<td style="color:var(--red)">'+fmt(r.low)+'</td>'+
        '<td style="color:'+cc+'">'+fmt(close)+'</td>'+
        '<td>'+fmtBig(vol)+'</td>'+
      '</tr>';
    }).join('')+'</tbody></table></div>';
}

/* ─────────────────────────────────
   PROFILE TAB
───────────────────────────────── */
function renderProfileTab(el, profile) {
  if(!profile){el.innerHTML='<div class="no-data">Profile unavailable</div>';return;}
  var fields=[
    {l:'Name (TH)',v:profile.companyNameTh},
    {l:'Name (EN)',v:profile.companyNameEn||profile.companyName},
    {l:'Sector',   v:profile.sector},
    {l:'Industry', v:profile.industry},
    {l:'Market',   v:profile.market},
    {l:'Listed',   v:profile.listedDate||profile.firstTradingDate},
    {l:'Par Value',v:profile.parValue!=null?('฿'+fmt(profile.parValue)):null},
    {l:'Shares',   v:fmtBig(profile.listedShares||profile.paidUpCapital)},
    {l:'Website',  v:profile.website||profile.url},
    {l:'Tel',      v:profile.telephone||profile.tel},
  ].filter(function(f){return f.v&&f.v!=='—';});
  el.innerHTML='<div class="profile-grid">'+fields.map(function(f){
    return '<div class="prow"><div class="pl">'+f.l+'</div><div class="pv">'+esc(clamp(String(f.v),30))+'</div></div>';
  }).join('')+'</div>'+(profile.businessType?'<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)"><div style="font-size:8px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Business</div><div style="font-size:11px;color:var(--muted);line-height:1.7">'+esc(clamp(String(profile.businessType),300))+'</div></div>':'');
}

/* ─────────────────────────────────
   DEBUG TAB
───────────────────────────────── */
function renderDebugTab(el) {
  if(!currentData){el.innerHTML='<div class="no-data">No data yet</div>';return;}
  el.innerHTML='<div style="font-size:10px;font-family:monospace;line-height:1.8;">'+
    (currentData.rawResults||[]).map(function(r){
      var color=r.ok?'var(--green)':'var(--red)';
      var detail=r.ok
        ?'keys: '+Object.keys(r.value||{}).slice(0,20).join(', ')
        :r.msg+(r.stack?'\n'+r.stack.split('\n').slice(0,4).join('\n'):'');
      return '<div style="margin-bottom:8px;padding:8px;background:var(--bg3);border-radius:6px;border-left:2px solid '+color+'">'+
        '<div><span style="color:'+color+'">'+(r.ok?'✓':'✗')+'</span> <b>'+esc(r.key)+'</b></div>'+
        '<pre style="margin-top:4px;font-size:9px;color:var(--muted);white-space:pre-wrap;word-break:break-all">'+esc(detail)+'</pre>'+
      '</div>';
    }).join('')+
  '</div>';
}

/* ─────────────────────────────────
   EVENT WIRING
───────────────────────────────── */
document.getElementById('searchBtn').addEventListener('click', function(){ doSearch(document.getElementById('symbolInput').value); });
document.getElementById('symbolInput').addEventListener('keydown', function(e){ if(e.key==='Enter') doSearch(e.target.value); });
document.querySelectorAll('.chip').forEach(function(c){ c.addEventListener('click',function(){ doSearch(c.dataset.sym); }); });
document.querySelector('.tabs').addEventListener('click', function(e){ var t=e.target.closest('.tab'); if(t&&currentData) setActiveTab(t.dataset.tab); });

document.getElementById('clearLogBtn').addEventListener('click', function(){
  LOG_LINES=[];
  flushLog();
});

/* ─────────────────────────────────
   RESTORE LAST SYMBOL
───────────────────────────────── */
chrome.storage.local.get(['lastSymbol'], function(result){
  if(result.lastSymbol) document.getElementById('symbolInput').value=result.lastSymbol;
});
