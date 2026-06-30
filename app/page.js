"use client";
import { useState } from "react";

export default function Page() {
  const [postcode, setPostcode] = useState("");
  const [huisnummer, setHuisnummer] = useState("");
  const [toevoeging, setToevoeging] = useState("");
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState("");
  const [data, setData] = useState(null);
  const [gekopieerd, setGekopieerd] = useState(false);

  const zoek = async () => {
    const pc = postcode.replace(/\s/g,"").toUpperCase();
    if (!pc || !huisnummer) { setFout("Vul postcode en huisnummer in."); return; }
    if (!/^\d{4}[A-Z]{2}$/.test(pc)) { setFout("Postcode moet formaat 1234AB hebben."); return; }
    setFout(""); setLaden(true); setData(null);
    try {
      const res = await fetch(`/api/oppervlakte?postcode=${pc}&huisnummer=${huisnummer}&toevoeging=${toevoeging}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch(e) { setFout(e.message); }
    setLaden(false);
  };

  const kopieer = () => {
    if (!data) return;
    const vlakkenTekst = data.dakvlakken.map((v,i) =>
      `  Dakvlak ${i+1} (${v.richting}): ${v.oppervlak} m²${v.helling!=null?`, helling ${v.helling}°`:""}`
    ).join("\n");
    navigator.clipboard.writeText(
      `Adres: ${data.adres}\nTotaal dakoppervlak: ${data.totaalDak} m²\n${vlakkenTekst}\nGebruiksoppervlak: ${data.gebruiksoppervlak || "—"} m²\nBouwlagen: ${data.bouwlagen || "—"}\nBouwjaar: ${data.bouwjaar || "—"}\nDatabron: ${data.databron}`
    );
    setGekopieerd(true); setTimeout(() => setGekopieerd(false), 2000);
  };

  const G="#2D6A4F",GL="#52B788",GZ="#D8F3DC",S="#6B7280",R="#E5E7EB",BG="#F7F9F7",ROOD="#DC2626";
  const inp={fontFamily:"inherit",fontSize:16,padding:"11px 14px",border:`1px solid ${R}`,borderRadius:8,outline:"none",background:BG,color:"#1A1A1A",width:"100%",boxSizing:"border-box"};
  const lbl={fontSize:12,fontWeight:500,color:S,textTransform:"uppercase",letterSpacing:"0.5px"};

  const richtingKleur = {
    Noord: "#3B82F6", Noordoost: "#6366F1", Oost: "#8B5CF6", Zuidoost: "#D946EF",
    Zuid: "#F59E0B", Zuidwest: "#F97316", West: "#EF4444", Noordwest: "#06B6D4",
    "Plat dak": "#6B7280", "Schuin (richting onbekend)": "#9CA3AF", "Onbekend (schatting)": "#9CA3AF",
  };

  return (
    <div style={{fontFamily:"system-ui,sans-serif",background:BG,minHeight:"100vh"}}>
      <div style={{background:"#fff",borderBottom:`1px solid ${R}`,padding:"16px 24px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:36,height:36,background:G,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
        </div>
        <div>
          <div style={{fontSize:16,fontWeight:600}}>Oppervlakte Tool</div>
          <div style={{fontSize:12,color:S}}>Dakvlakken per richting voor verduurzamingsrapporten</div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"40px 20px"}}>
        <h2 style={{fontSize:24,fontWeight:700,marginBottom:8}}>Dakoppervlaktes ophalen</h2>
        <p style={{color:S,fontSize:15,lineHeight:1.6,marginBottom:32}}>
          Vul postcode en huisnummer in. Per dakvlak krijg je oriëntatie, hellingshoek en m² uit <strong>3DBAG (TU Delft)</strong>.
        </p>

        <div style={{background:"#fff",border:`1px solid ${R}`,borderRadius:12,padding:20,marginBottom:28,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:6,flex:"0 0 150px"}}>
              <label style={lbl}>Postcode</label>
              <input style={inp} placeholder="1234AB" value={postcode} onChange={e=>setPostcode(e.target.value.replace(/\s/g,"").toUpperCase().slice(0,6))} onKeyDown={e=>e.key==="Enter"&&zoek()} maxLength={6}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,flex:"0 0 90px"}}>
              <label style={lbl}>Huisnr.</label>
              <input style={inp} placeholder="12" value={huisnummer} onChange={e=>setHuisnummer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&zoek()} inputMode="numeric"/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,flex:"0 0 75px"}}>
              <label style={lbl}>Toev.</label>
              <input style={inp} placeholder="A" value={toevoeging} onChange={e=>setToevoeging(e.target.value)} onKeyDown={e=>e.key==="Enter"&&zoek()}/>
            </div>
            <button onClick={zoek} disabled={laden} style={{height:46,padding:"0 22px",background:laden?"#9CA3AF":G,color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:500,cursor:laden?"not-allowed":"pointer",fontFamily:"inherit",flexShrink:0}}>
              {laden?"Ophalen…":"Ophalen"}
            </button>
          </div>
          <div style={{minHeight:26,paddingTop:10,fontSize:14}}>
            {laden&&<span style={{color:S}}>⏳ 3D dakvlakken berekenen…</span>}
            {fout&&<span style={{color:ROOD}}>{fout}</span>}
          </div>
        </div>

        {data&&(
          <div>
            <div style={{fontSize:12,color:S,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:500}}>Gevonden pand</div>
            <div style={{fontSize:19,fontWeight:700,marginBottom:16}}>{data.adres}</div>

            {data.databron?.includes("schatting")&&(
              <div style={{background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#92400E",marginBottom:20,lineHeight:1.5}}>
                ⚠️ Geen 3DBAG geometrie beschikbaar — oppervlak is een <strong>schatting</strong>, niet per dakvlak.
                {data.debug && (
                  <pre style={{marginTop:8,fontSize:11,whiteSpace:"pre-wrap",background:"#fff",padding:8,borderRadius:6,overflow:"auto",maxHeight:300}}>
                    {JSON.stringify(data.debug, null, 2)}
                  </pre>
                )}
              </div>
            )}
            {data.databron?.includes("geen vlak-detail")&&(
              <div style={{background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#92400E",marginBottom:20,lineHeight:1.5}}>
                ⚠️ 3DBAG gaf alleen totalen terug, geen individuele dakvlak-richtingen voor dit pand.
              </div>
            )}

            {/* Totaal kaart */}
            <div style={{background:GZ,border:`1px solid ${GL}`,borderRadius:12,padding:20,marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:500,color:G,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Totaal dakoppervlak</div>
              <div style={{fontFamily:"monospace",fontSize:32,fontWeight:600,color:G}}>
                {data.totaalDak}<span style={{fontSize:15,fontWeight:400,color:S,marginLeft:4,fontFamily:"inherit"}}>m²</span>
              </div>
              <div style={{fontSize:12,color:S,marginTop:4}}>{data.dakvlakken.length} dakvlak{data.dakvlakken.length!==1?"ken":""} gevonden</div>
            </div>

            {/* Per dakvlak */}
            <div style={{background:"#fff",border:`1px solid ${R}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
              <div style={{padding:"13px 20px",fontSize:12,fontWeight:600,color:S,textTransform:"uppercase",letterSpacing:"0.5px",borderBottom:`1px solid ${R}`,background:BG}}>
                Dakvlakken per richting
              </div>
              {data.dakvlakken.map((v, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom: i<data.dakvlakken.length-1 ? `1px solid ${R}` : "none",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:richtingKleur[v.richting]||"#9CA3AF",flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:14,fontWeight:600}}>{v.richting}</div>
                      {v.helling!=null && <div style={{fontSize:12,color:S}}>helling {v.helling}°{v.azimut!=null?` · azimut ${v.azimut}°`:""}</div>}
                    </div>
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:18,fontWeight:600}}>{v.oppervlak}<span style={{fontSize:12,fontWeight:400,color:S,marginLeft:2,fontFamily:"inherit"}}>m²</span></div>
                </div>
              ))}
            </div>

            {/* Details */}
            <div style={{background:"#fff",border:`1px solid ${R}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
              <div style={{padding:"13px 20px",fontSize:12,fontWeight:600,color:S,textTransform:"uppercase",letterSpacing:"0.5px",borderBottom:`1px solid ${R}`,background:BG}}>Pandgegevens</div>
              {[["Gebruiksoppervlak (GO)",data.gebruiksoppervlak?`${data.gebruiksoppervlak} m²`:"—"],["Bouwlagen",data.bouwlagen||"—"],["Bouwjaar",data.bouwjaar||"—"],["Gebruiksdoel",data.gebruiksdoel],["BAG Pand ID",data.pandId||"—"],["Databron",data.databron]].map(([n,w])=>(
                <div key={n} style={{display:"flex",justifyContent:"space-between",padding:"12px 20px",borderBottom:`1px solid ${R}`,fontSize:14,gap:12}}>
                  <span style={{color:S,flexShrink:0}}>{n}</span>
                  <span style={{fontSize:13,fontWeight:500,textAlign:"right",maxWidth:"65%",wordBreak:"break-all"}}>{w}</span>
                </div>
              ))}
            </div>

            <button onClick={kopieer} style={{fontFamily:"inherit",fontSize:13,fontWeight:500,background:"none",border:`1px solid ${R}`,borderRadius:7,padding:"8px 16px",cursor:"pointer",color:S,marginBottom:12}}>
              {gekopieerd?"✓ Gekopieerd!":"📋 Kopieer gegevens"}
            </button>
            <div style={{fontSize:12,color:S}}>
              Data via <a href="https://3dbag.nl" target="_blank" rel="noreferrer" style={{color:G}}>3DBAG (TU Delft)</a> & <a href="https://www.pdok.nl" target="_blank" rel="noreferrer" style={{color:G}}>PDOK/BAG</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
