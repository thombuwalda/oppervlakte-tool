export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get("postcode")?.replace(/\s/g,"").toUpperCase();
  const huisnummer = searchParams.get("huisnummer");
  const toevoeging = searchParams.get("toevoeging") || "";

  if (!postcode || !huisnummer) {
    return Response.json({ error: "Postcode en huisnummer zijn verplicht" }, { status: 400 });
  }

  try {
    // Stap 1: PDOK - adres opzoeken
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

    // Stap 2: 3DBAG - echte oppervlaktes ophalen
    let dakOpp = null, gevelOpp = null, bouwlagen = null, daktype = null, databron = "3DBAG (TU Delft)";

    const drieUrl = `https://data.3dbag.nl/api/BAG3D/v2/wfs?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=BAG3D:lod22&COUNT=1&CQL_FILTER=DWITHIN(wkb_geometry,POINT(${rdX}%20${rdY}),10,meters)&outputFormat=application%2Fjson`;
    const drieRes = await fetch(drieUrl);

    if (drieRes.ok) {
      const drieData = await drieRes.json();
      if (drieData.features?.length) {
        const p = drieData.features[0].properties;
        const plat = parseFloat(p.b3_opp_dak_plat) || 0;
        const schuin = parseFloat(p.b3_opp_dak_schuin) || 0;
        dakOpp = Math.round(plat + schuin);
        gevelOpp = Math.round(parseFloat(p.b3_opp_buitenmuur) || 0);
        bouwlagen = parseInt(p.b3_bouwlagen) || null;
        daktype = plat > 0 && schuin === 0 ? "Plat dak" : schuin > 0 && plat === 0 ? "Schuin dak" : "Gemengd";
      }
    }

    // Fallback op BAG data
    if (!dakOpp) {
      databron = "BAG schatting (geen 3DBAG data)";
      const go = doc.oppervlakte || 80;
      bouwlagen = 2;
      dakOpp = Math.round(go * 1.12);
      gevelOpp = Math.round(Math.sqrt(go) * 4 * (bouwlagen * 2.8));
      daktype = "Onbekend";
    }

    return Response.json({
      adres: doc.weergavenaam,
      dakOpp, gevelOpp,
      gebruiksoppervlak: doc.oppervlakte || null,
      bouwlagen,
      bouwjaar: doc.bouwjaar || null,
      gebruiksdoel: doc.gebruiksdoel_gebouw?.[0] || "—",
      daktype, databron,
      pandId: doc.identificatie || "—",
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
