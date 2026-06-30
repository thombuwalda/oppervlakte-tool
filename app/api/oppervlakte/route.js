// app/api/oppervlakte/route.js
// Server-side: haalt BAG adres + 3D dakvlakken op uit 3DBAG CityJSON

function berekenDakvlak(vertices) {
  // vertices: array van [x,y,z]
  // Normaalvector via cross product
  const v1 = [vertices[1][0]-vertices[0][0], vertices[1][1]-vertices[0][1], vertices[1][2]-vertices[0][2]];
  const v2 = [vertices[2][0]-vertices[0][0], vertices[2][1]-vertices[0][1], vertices[2][2]-vertices[0][2]];
  let normaal = [
    v1[1]*v2[2] - v1[2]*v2[1],
    v1[2]*v2[0] - v1[0]*v2[2],
    v1[0]*v2[1] - v1[1]*v2[0],
  ];
  const len = Math.sqrt(normaal[0]**2 + normaal[1]**2 + normaal[2]**2);
  if (len === 0) return null;
  normaal = normaal.map(v => v / len);
  if (normaal[2] < 0) normaal = normaal.map(v => -v);

  const helling = Math.acos(Math.max(-1, Math.min(1, normaal[2]))) * (180 / Math.PI);
  let azimut = Math.atan2(normaal[0], normaal[1]) * (180 / Math.PI);
  if (azimut < 0) azimut += 360;

  // Oppervlak via Newell's method (3D polygon area)
  let oppVec = [0, 0, 0];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    oppVec[0] += p1[1] * p2[2] - p1[2] * p2[1];
    oppVec[1] += p1[2] * p2[0] - p1[0] * p2[2];
    oppVec[2] += p1[0] * p2[1] - p1[1] * p2[0];
  }
  const oppervlak = Math.sqrt(oppVec[0]**2 + oppVec[1]**2 + oppVec[2]**2) / 2;

  const richtingen = ["Noord","Noordoost","Oost","Zuidoost","Zuid","Zuidwest","West","Noordwest"];
  const idx = Math.round(azimut / 45) % 8;

  return {
    oppervlak: Math.round(oppervlak * 10) / 10,
    azimut: Math.round(azimut * 10) / 10,
    helling: Math.round(helling * 10) / 10,
    richting: richtingen[idx],
  };
}

function isDakvlak(helling) {
  // Vloeren/plafonds zijn ~0 of ~180 graden helling, gevels ~90 graden
  // Dakvlakken: tussen 5 en 85 graden (schuin) OF base zelf vlak (<5) maar als hoogste vlak = plat dak
  return helling < 85;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get("postcode")?.replace(/\s/g, "").toUpperCase();
  const huisnummer = searchParams.get("huisnummer");
  const toevoeging = searchParams.get("toevoeging") || "";

  if (!postcode || !huisnummer) {
    return Response.json({ error: "Postcode en huisnummer zijn verplicht" }, { status: 400 });
  }
  if (!/^\d{4}[A-Z]{2}$/.test(postcode)) {
    return Response.json({ error: "Ongeldig postcode formaat (gebruik 1234AB)" }, { status: 400 });
  }

  try {
    // Stap 1: PDOK - adres opzoeken, geeft coordinaten + BAG pand-ID
    const pdokUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(postcode+" "+huisnummer+toevoeging)}&fq=type:adres&rows=1&fl=*`;
    const pdokRes = await fetch(pdokUrl);
    if (!pdokRes.ok) throw new Error("PDOK niet bereikbaar");
    const pdokData = await pdokRes.json();

    if (!pdokData.response?.docs?.length) {
      return Response.json({ error: "Adres niet gevonden" }, { status: 404 });
    }

    const doc = pdokData.response.docs[0];
    const centroideRD = doc.centroide_rd;
    if (!centroideRD) return Response.json({ error: "Geen coördinaten gevonden" }, { status: 404 });
    const [rdX, rdY] = centroideRD.split(" ").map(parseFloat);

    // Stap 2: 3DBAG tile bepalen en CityJSON ophalen
    // 3DBAG gebruikt een tegelsysteem; we zoeken via de collection items API
    const bboxSize = 5;
    const bbox = `${rdX-bboxSize},${rdY-bboxSize},${rdX+bboxSize},${rdY+bboxSize}`;
    
    // 3D BAG OGC API Features endpoint
    const featuresUrl = `https://api.3dbag.nl/collections/pand/items?bbox=${bbox}&bbox-crs=http://www.opengis.net/def/crs/EPSG/0/28992&f=json&limit=5`;
    
    let dakvlakken = [];
    let bouwjaar = null, bouwlagen = null, pandId = doc.identificatie || null;
    let databron = "3DBAG (TU Delft)";
    let totaalDak = null;

    try {
      const featRes = await fetch(featuresUrl, { headers: { Accept: "application/json" } });
      if (featRes.ok) {
        const featData = await featRes.json();
        if (featData.features?.length) {
          const feature = featData.features[0];
          pandId = feature.properties?.identificatie || pandId;
          bouwjaar = feature.properties?.oorspronkelijkbouwjaar || null;
          bouwlagen = feature.properties?.["b3_bouwlagen"] || null;

          // CityJSON geometry uit feature halen (LoD2.2)
          const geom = feature.geometry;
          if (geom && geom.type === "MultiPolygon") {
            for (const polygon of geom.coordinates) {
              const ring = polygon[0]; // buitenring
              if (ring.length >= 4) {
                const info = berekenDakvlak(ring);
                if (info && info.oppervlak > 1 && isDakvlak(info.helling)) {
                  dakvlakken.push(info);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("3DBAG features fout:", e.message);
    }

    // Combineer dakvlakken met dezelfde richting+helling (afronding) en filter ruis
    if (dakvlakken.length > 0) {
      totaalDak = Math.round(dakvlakken.reduce((sum, d) => sum + d.oppervlak, 0) * 10) / 10;
    }

    // Fallback: oude WFS methode met totalen als geometry niet werkte
    if (dakvlakken.length === 0) {
      try {
        const wfsUrl = `https://data.3dbag.nl/api/BAG3D/v2/wfs?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=BAG3D:lod22&COUNT=1&CQL_FILTER=DWITHIN(wkb_geometry,POINT(${rdX}%20${rdY}),10,meters)&outputFormat=application%2Fjson`;
        const wfsRes = await fetch(wfsUrl);
        if (wfsRes.ok) {
          const wfsData = await wfsRes.json();
          if (wfsData.features?.length) {
            const p = wfsData.features[0].properties;
            const plat = parseFloat(p.b3_opp_dak_plat) || 0;
            const schuin = parseFloat(p.b3_opp_dak_schuin) || 0;
            totaalDak = Math.round((plat + schuin) * 10) / 10;
            bouwlagen = parseInt(p.b3_bouwlagen) || bouwlagen;
            pandId = p.identificatie || pandId;
            databron = "3DBAG totaal (geen vlak-detail beschikbaar)";
            if (plat > 0) dakvlakken.push({ oppervlak: Math.round(plat*10)/10, richting: "Plat dak", azimut: null, helling: 0 });
            if (schuin > 0) dakvlakken.push({ oppervlak: Math.round(schuin*10)/10, richting: "Schuin (richting onbekend)", azimut: null, helling: null });
          }
        }
      } catch (e) {
        console.warn("3DBAG WFS fallback fout:", e.message);
      }
    }

    // Laatste fallback: schatting
    if (dakvlakken.length === 0) {
      databron = "BAG schatting (geen 3DBAG data beschikbaar)";
      const go = doc.oppervlakte || 80;
      bouwlagen = bouwlagen || 2;
      totaalDak = Math.round(go * 1.12);
      dakvlakken.push({ oppervlak: totaalDak, richting: "Onbekend (schatting)", azimut: null, helling: null });
    }

    return Response.json({
      adres: doc.weergavenaam,
      dakvlakken,
      totaalDak,
      gebruiksoppervlak: doc.oppervlakte || null,
      bouwlagen,
      bouwjaar: bouwjaar || doc.bouwjaar || null,
      gebruiksdoel: doc.gebruiksdoel_gebouw?.[0] || "—",
      pandId,
      databron,
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
