// app/api/oppervlakte/route.js
// Haalt BAG adres op via PDOK, dan echte 3D dakvlak-data via 3DBAG CityJSON

function berekenOppervlak(pts) {
  // pts: array van [x,y,z] in echte (getransformeerde) coordinaten
  // Newell's method voor 3D polygon oppervlak
  let opp = [0, 0, 0];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    opp[0] += p1[1] * p2[2] - p1[2] * p2[1];
    opp[1] += p1[2] * p2[0] - p1[0] * p2[2];
    opp[2] += p1[0] * p2[1] - p1[1] * p2[0];
  }
  return Math.sqrt(opp[0] ** 2 + opp[1] ** 2 + opp[2] ** 2) / 2;
}

function richtingNaam(azimut) {
  if (azimut == null) return "Onbekend";
  const richtingen = ["Noord", "Noordoost", "Oost", "Zuidoost", "Zuid", "Zuidwest", "West", "Noordwest"];
  const idx = Math.round(azimut / 45) % 8;
  return richtingen[idx];
}

function parseCityJsonDakvlakken(cj, gevraagdId) {
  const vertices = cj.vertices;
  const transform = cj.transform || { scale: [1, 1, 1], translate: [0, 0, 0] };
  const { scale, translate } = transform;

  const echteCoord = (idx) => {
    const v = vertices[idx];
    return [
      v[0] * scale[0] + translate[0],
      v[1] * scale[1] + translate[1],
      v[2] * scale[2] + translate[2],
    ];
  };

  const dakvlakken = [];

  for (const [objId, obj] of Object.entries(cj.CityObjects || {})) {
    if (obj.type !== "BuildingPart") continue;
    // Filter op pand-ID indien meerdere panden in de response staan
    if (gevraagdId && obj.parents && !obj.parents.includes(gevraagdId)) continue;

    for (const geom of obj.geometry || []) {
      if (geom.lod !== "2.2") continue;
      const semantics = geom.semantics || {};
      const surfaces = semantics.surfaces || [];
      const values = semantics.values || [];
      const boundaries = geom.boundaries || [];

      if (geom.type !== "Solid") continue;

      for (let shellIdx = 0; shellIdx < boundaries.length; shellIdx++) {
        const shell = boundaries[shellIdx];
        const valShell = values[shellIdx] || [];

        for (let faceIdx = 0; faceIdx < shell.length; faceIdx++) {
          const surfIdx = valShell[faceIdx];
          if (surfIdx == null || surfIdx >= surfaces.length) continue;
          const surfInfo = surfaces[surfIdx];
          if (surfInfo.type !== "RoofSurface") continue;

          const face = shell[faceIdx];
          const ring = face[0]; // buitenring
          if (!ring || ring.length < 3) continue;

          const pts = ring.map(echteCoord);
          const oppervlak = berekenOppervlak(pts);

          if (oppervlak < 0.5) continue; // ruis filteren

          const azimut = surfInfo.b3_azimut ?? null;
          const helling = surfInfo.b3_hellingshoek ?? null;

          dakvlakken.push({
            oppervlak: Math.round(oppervlak * 10) / 10,
            azimut: azimut != null ? Math.round(azimut * 10) / 10 : null,
            helling: helling != null ? Math.round(helling * 10) / 10 : null,
            richting: richtingNaam(azimut),
          });
        }
      }
    }
  }

  return dakvlakken;
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
    // Stap 1: PDOK - adres opzoeken
    const pdokUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(postcode + " " + huisnummer + toevoeging)}&fq=type:adres&rows=1&fl=*`;
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

    // Stap 2: 3DBAG OGC API Features — bbox rondom het pand
    const half = 8;
    const bbox = `${rdX - half},${rdY - half},${rdX + half},${rdY + half}`;
    const featuresUrl = `https://api.3dbag.nl/collections/pand/items?bbox=${bbox}&limit=5`;

    let dakvlakken = [];
    let pandId = null;
    let bouwjaar = null;
    let bouwlagen = null;
    let daktype = null;
    let databron = "3DBAG (TU Delft) — per dakvlak";

    const drieRes = await fetch(featuresUrl, { headers: { Accept: "application/json" } });
    if (drieRes.ok) {
      const cj = await drieRes.json();
      const cityObjects = cj.CityObjects || {};

      // Vind het hoofdgebouw (type "Building") het dichtst bij ons punt
      let beste = null;
      let besteAfstand = Infinity;
      for (const [id, obj] of Object.entries(cityObjects)) {
        if (obj.type !== "Building") continue;
        // Gebruik attributes als die er zijn, anders skip afstandscheck
        beste = { id, obj };
        besteAfstand = 0;
        break; // bbox is klein genoeg, neem de eerste Building
      }

      if (beste) {
        pandId = beste.id;
        bouwjaar = beste.obj.attributes?.oorspronkelijkbouwjaar || null;
        bouwlagen = beste.obj.attributes?.b3_bouwlagen || null;
        daktype = beste.obj.attributes?.b3_dak_type || null;

        dakvlakken = parseCityJsonDakvlakken(cj, pandId);
      }
    }

    let totaalDak = null;
    if (dakvlakken.length > 0) {
      totaalDak = Math.round(dakvlakken.reduce((s, d) => s + d.oppervlak, 0) * 10) / 10;
    } else {
      // Fallback: schatting
      databron = "BAG schatting (geen 3DBAG geometrie gevonden)";
      const go = doc.oppervlakte || 80;
      bouwlagen = bouwlagen || 2;
      totaalDak = Math.round(go * 1.12 * 10) / 10;
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
      daktype,
      pandId,
      databron,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
