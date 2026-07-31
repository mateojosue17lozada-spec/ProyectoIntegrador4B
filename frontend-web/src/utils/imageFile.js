export const imageToDataUrl=(file,max=900,quality=.82)=>new Promise((resolve,reject)=>{
 if(!file?.type?.startsWith("image/"))return reject(new Error("Seleccione una imagen válida"));
 const reader=new FileReader();reader.onerror=()=>reject(new Error("No se pudo leer la imagen"));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Imagen dañada"));img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL(file.type==="image/png"?"image/png":"image/jpeg",quality))};img.src=reader.result};reader.readAsDataURL(file)
});
