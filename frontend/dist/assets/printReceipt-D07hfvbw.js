import{z as n,a9 as r}from"./index-DqYYnUuS.js";function a(i,e){const t=r(i,e),o=window.open("","_blank","width=320,height=600");if(!o){n.error("Pop-up diblokir browser. Izinkan pop-up untuk mencetak.");return}o.document.write(`
    <html><head><title>Struk</title>
    <style>body{margin:0;padding:10px;background:white;}@media print{body{margin:0;}}</style>
    </head><body>${t}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>
  `)}async function c(i,e,t){if((t==null?void 0:t.status)==="connected"){if(await t.print(i,e)){n.success("Struk dikirim ke printer!");return}n.error("Gagal kirim ke printer, mencetak via browser...")}a(i,e)}export{c as p};
