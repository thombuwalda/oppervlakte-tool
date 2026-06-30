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
    navigator.clipboard.writeText(`Adres: ${data.adres}\nDakoppervlak: ${data.dakOpp} m²\nGeveloppervlak: ${data.gevelOpp} m²\nGebruiksoppervlak: ${data.gebruiksoppervlak || "—"} m²\nBouwlagen: ${data.bouwlagen || "—"}\nBouwjaar: ${data.bouwjaar || "—"}\nDaktype: ${data.daktype}\nDatabron: ${data.databron}`);
    setGekopieerd(true); setTimeout(() => setGekopieerd(false), 2000);
  };

  const G="#2D6A4F",GL="#52B788",GZ="#D8F3DC",S="#6B7280",R="#E5E7EB",BG="#F7F9F7",ROOD="#DC2626";
  const inp={fontFamily:"inherit",fontSize:16,padding:"11px 14px",border:`1px solid ${R}`,borderRadius:8,outline:"none",background:BG,color:"#1A1A1A",width:"100%",boxSizing:"border-box"};
  const lbl={fontSize:12,fontWeight:500,color:S,textTransform:"uppercase",letterSpacing:"0.5px"};

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
          <div style={{fontSize:12,color:S}}>Dak & gevel m² voor verduurzamingsrapporten</div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"40px 20px"}}>
        <h2 style={{fontSize:24,fontWeight:700,marginBottom:8}}>Gebouwoppervlaktes ophalen</h2>
        <p style={{color:S,fontSize:15,lineHeight:1.6,marginBottom:32}}>
          Vul postcode en huisnummer in. Echte data uit <strong>3DBAG (TU Delft)</strong> en <strong>BAG kadaster</strong>.
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
            {laden&&<span style={{color:S}}>⏳ Data ophalen uit BAG en 3DBAG…</span>}
            {fout&&<span style={{color:ROOD}}>{fout}</span>}
          </div>
        </div>

        {data&&(
          <div>
            <div style={{fontSize:12,color:S,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px",fontWeight:500}}>Gevonden pand</div>
            <div style={{fontSize:19,fontWeight:700,marginBottom:16}}>{data.adres}</div>
            {data.databron?.includes("schatting")&&(
              <div style={{background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#92400E",marginBottom:20,lineHeight:1.5}}>
                ⚠️ Geen 3DBAG data beschikbaar — oppervlaktes zijn <strong>geschat</strong> op basis van BAG.
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:24}}>
              {[
                {label:"Dakoppervlak",waarde:data.dakOpp,eenheid:"m²",sub:"totaal dakvlak",accent:true},
                {label:"Geveloppervlak",waarde:data.gevelOpp,eenheid:"m²",sub:"alle gevels",accent:true},
                {label:"Gebruiksoppervlak",waarde:data.gebruiksoppervlak||"—",eenheid:data.gebruiksoppervlak?"m²":"",sub:"GO uit BAG"},
                {label:"Bouwlagen",waarde:data.bouwlagen||"—",sub:"verdiepingen"},
              ].map(({label,waarde,eenheid,sub,accent})=>(
                <div key={label} style={{background:accent?GZ:"#fff",border:`1px solid ${accent?GL:R}`,borderRadius:12,padding:20}}>
                  <div style={{fontSize:12,fontWeight:500,color:accent?G:S,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>{label}</div>
                  <div style={{fontFamily:"monospace",fontSize:28,fontWeight:600,color:accent?G:"#1A1A1A"}}>
                    {waarde}<span style={{fontSize:14,fontWeight:400,color:S,marginLeft:3,fontFamily:"inherit"}}>{eenheid}</span>
                  </div>
                  <div style={{fontSize:12,color:S,marginTop:4}}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#fff",border:`1px solid ${R}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
              <div style={{padding:"13px 20px",fontSize:12,fontWeight:600,color:S,textTransform:"uppercase",letterSpacing:"0.5px",borderBottom:`1px solid ${R}`,background:BG}}>Pandgegevens</div>
              {[["Bouwjaar",data.bouwjaar||"—"],["Gebruiksdoel",data.gebruiksdoel],["Daktype",data.daktype],["BAG Pand ID",data.pandId],["Databron",data.databron]].map(([n,w])=>(
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
