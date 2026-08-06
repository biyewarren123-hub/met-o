(function(){
  const statusEl = document.getElementById('status');
  const hero = document.getElementById('hero');
  const hourlyWrap = document.getElementById('hourly');
  const daysWrap = document.getElementById('days');
  const hourlyLabel = document.getElementById('hourlyLabel');
  const daysLabel = document.getElementById('daysLabel');

  // weather code -> [icon, description FR, category]
  const WMO = {
    0:['☀️','Ciel dégagé','clear'], 1:['🌤️','Plutôt dégagé','clear'], 2:['⛅','Partiellement nuageux','cloud'],
    3:['☁️','Couvert','cloud'], 45:['🌫️','Brouillard','cloud'], 48:['🌫️','Brouillard givrant','cloud'],
    51:['🌦️','Bruine légère','rain'], 53:['🌦️','Bruine','rain'], 55:['🌧️','Bruine forte','rain'],
    56:['🌧️','Bruine verglaçante','rain'], 57:['🌧️','Bruine verglaçante forte','rain'],
    61:['🌧️','Pluie légère','rain'], 63:['🌧️','Pluie','rain'], 65:['🌧️','Pluie forte','rain'],
    66:['🌧️','Pluie verglaçante','rain'], 67:['🌧️','Pluie verglaçante forte','rain'],
    71:['🌨️','Neige légère','snow'], 73:['🌨️','Neige','snow'], 75:['❄️','Neige forte','snow'],
    77:['❄️','Grains de neige','snow'],
    80:['🌦️','Averses légères','rain'], 81:['🌧️','Averses','rain'], 82:['⛈️','Averses violentes','rain'],
    85:['🌨️','Averses de neige','snow'], 86:['❄️','Averses de neige fortes','snow'],
    95:['⛈️','Orage','storm'], 96:['⛈️','Orage avec grêle','storm'], 99:['⛈️','Orage violent avec grêle','storm']
  };

  function setSky(category, isDay){
    const body = document.body;
    body.classList.toggle('night', !isDay);
    document.getElementById('sun').style.opacity = (isDay && category!=='storm') ? '1' : '0';
    document.getElementById('moon').style.opacity = (!isDay) ? '1' : '0';
    document.getElementById('stars').style.opacity = (!isDay) ? '1' : '0';

    // clouds
    const cloudsWrap = document.getElementById('clouds');
    cloudsWrap.innerHTML = '';
    const cloudCount = category==='cloud'||category==='rain'||category==='snow'||category==='storm' ? 6 : (category==='clear'?1:0);
    for(let i=0;i<cloudCount;i++){
      const c = document.createElement('div');
      c.className='cloud';
      const w = 100+Math.random()*160, h = w*0.5;
      c.style.width=w+'px'; c.style.height=h+'px';
      c.style.top=(5+Math.random()*30)+'%';
      c.style.left=(-20+Math.random()*120)+'%';
      c.style.opacity = 0.35+Math.random()*0.4;
      cloudsWrap.appendChild(c);
    }
    setTimeout(()=>{ document.querySelectorAll('.cloud').forEach(c=>c.style.opacity = c.style.opacity); }, 50);
    document.querySelectorAll('.cloud').forEach(c=> c.style.opacity = c.style.opacity);
    // force fade-in
    requestAnimationFrame(()=>{ document.querySelectorAll('.cloud').forEach(c=>{ c.style.transition='opacity 1.2s ease'; }); });

    // precipitation
    const precipWrap = document.getElementById('precip');
    precipWrap.innerHTML = '';
    if(category==='rain' || category==='storm'){
      for(let i=0;i<50;i++){
        const d = document.createElement('div');
        d.className='drop';
        d.style.left = Math.random()*100+'%';
        d.style.animationDuration = (0.5+Math.random()*0.5)+'s';
        d.style.animationDelay = (Math.random()*1)+'s';
        precipWrap.appendChild(d);
      }
    } else if(category==='snow'){
      for(let i=0;i<40;i++){
        const f = document.createElement('div');
        f.className='flake';
        f.style.left = Math.random()*100+'%';
        f.style.animationDuration = (3+Math.random()*3)+'s';
        f.style.animationDelay = (Math.random()*3)+'s';
        precipWrap.appendChild(f);
      }
    }
  }

  function fmtHour(iso){
    const d = new Date(iso);
    return d.getHours().toString().padStart(2,'0')+'h';
  }
  function fmtDay(iso){
    const d = new Date(iso+'T00:00:00');
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    return days[d.getDay()];
  }

  async function geocodeAttempt(name, language){
    let url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&format=json`;
    if(language) url += `&language=${language}`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('geocode failed');
    const data = await r.json();
    if(!data.results || !data.results.length) return null;
    const g = data.results[0];
    return { lat:g.latitude, lon:g.longitude, name:g.name, admin:g.admin1||'', country:g.country||'' };
  }

  async function geocode(rawName){
    const name = rawName.trim();
    if(!name) return null;
    // 1st try: French results. 2nd try: no language filter (many smaller towns
    // have no French translation and return nothing with language=fr).
    // 3rd try: English, which the API resolves best for.
    let result = await geocodeAttempt(name, 'fr');
    if(!result) result = await geocodeAttempt(name, '');
    if(!result) result = await geocodeAttempt(name, 'en');
    return result;
  }

  async function reverseGeocode(lat, lon){
    try{
      const url = `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}`;
    }catch(e){}
    return null;
  }

  async function fetchWeather(lat, lon){
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,is_day,wind_speed_10m` +
      `&hourly=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=7&timezone=auto`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('forecast failed');
    return r.json();
  }

  function render(place, data){
    const cur = data.current;
    const wmo = WMO[cur.weather_code] || ['❔','Inconnu','clear'];
    setSky(wmo[2], !!cur.is_day);

    document.getElementById('placeName').textContent =
      place ? [place.name, place.admin, place.country].filter(Boolean).join(', ') : 'Votre position';
    document.getElementById('temp').innerHTML = Math.round(cur.temperature_2m) + '<sup>°C</sup>';
    document.getElementById('desc').textContent = wmo[1] + '  ' + wmo[0];

    const todayMax = Math.round(data.daily.temperature_2m_max[0]);
    const todayMin = Math.round(data.daily.temperature_2m_min[0]);
    document.getElementById('range').textContent =
      `Max ${todayMax}° · Min ${todayMin}° · Vent ${Math.round(cur.wind_speed_10m)} km/h`;

    hero.style.display = 'block';

    // hourly: next 12 hours from now
    const nowIdx = data.hourly.time.findIndex(t => new Date(t) >= new Date());
    const startIdx = nowIdx === -1 ? 0 : nowIdx;
    hourlyWrap.innerHTML = '';
    for(let i=startIdx; i<Math.min(startIdx+12, data.hourly.time.length); i++){
      const w = WMO[data.hourly.weather_code[i]] || ['❔','',''];
      const card = document.createElement('div');
      card.className = 'hour-card';
      card.innerHTML = `<div class="t">${fmtHour(data.hourly.time[i])}</div>
        <div class="ic">${w[0]}</div>
        <div class="v">${Math.round(data.hourly.temperature_2m[i])}°</div>`;
      hourlyWrap.appendChild(card);
    }
    hourlyWrap.style.display = 'flex';
    hourlyLabel.style.display = 'block';

    // daily
    daysWrap.innerHTML = '';
    for(let i=0;i<data.daily.time.length;i++){
      const w = WMO[data.daily.weather_code[i]] || ['❔','',''];
      const card = document.createElement('div');
      card.className = 'day-card';
      card.innerHTML = `<div class="d">${i===0?"Aujourd'hui":fmtDay(data.daily.time[i])}</div>
        <div class="ic">${w[0]}</div>
        <div class="hi">${Math.round(data.daily.temperature_2m_max[i])}°</div>
        <div class="lo">${Math.round(data.daily.temperature_2m_min[i])}°</div>`;
      daysWrap.appendChild(card);
    }
    daysWrap.style.display = 'grid';
    daysLabel.style.display = 'block';

    statusEl.textContent = '';
  }

  async function loadCity(name){
    statusEl.textContent = 'Recherche de « ' + name + ' »…';
    hero.style.display='none'; hourlyWrap.style.display='none'; daysWrap.style.display='none';
    hourlyLabel.style.display='none'; daysLabel.style.display='none';
    try{
      const place = await geocode(name);
      if(!place){ statusEl.textContent = "Ville introuvable. Vérifiez l'orthographe ou essayez avec le pays (ex: « Springfield, USA »)."; return; }
      const data = await fetchWeather(place.lat, place.lon);
      render(place, data);
    }catch(e){
      statusEl.textContent = "Erreur réseau : impossible de contacter l'API météo. Vérifiez votre connexion internet.";
      console.error(e);
    }
  }

  async function loadCoords(lat, lon){
    statusEl.textContent = 'Localisation en cours…';
    hero.style.display='none'; hourlyWrap.style.display='none'; daysWrap.style.display='none';
    hourlyLabel.style.display='none'; daysLabel.style.display='none';
    try{
      const data = await fetchWeather(lat, lon);
      render(null, data);
    }catch(e){
      statusEl.textContent = "Erreur lors de la récupération des données météo.";
    }
  }

  document.getElementById('searchForm').addEventListener('submit', function(e){
    e.preventDefault();
    const v = document.getElementById('cityInput').value.trim();
    if(v) loadCity(v);
  });

  document.getElementById('geoBtn').addEventListener('click', function(){
    if(!navigator.geolocation){
      statusEl.textContent = "La géolocalisation n'est pas supportée par votre navigateur.";
      return;
    }
    statusEl.textContent = 'Demande de localisation…';
    navigator.geolocation.getCurrentPosition(
      pos => loadCoords(pos.coords.latitude, pos.coords.longitude),
      () => { statusEl.textContent = "Localisation refusée ou indisponible."; }
    );
  });

  // default: try Paris on load as a friendly starting point
  loadCity('Paris');
})();